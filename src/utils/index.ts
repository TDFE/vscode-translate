/*
 * @Description: 公用方法
 * @Author: 郑泳健
 * @Date: 2022-05-27 18:22:28
 * @LastEditors: 郑泳健
 * @LastEditTime: 2022-06-07 17:46:52
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as _ from 'lodash';

interface Language {
    language: string;
}

interface Config {
    translation: Language;
}

class Position {
    // @ts-ignore
    start: number;
    // @ts-ignore
    cn: string;
    // @ts-ignore
    code: string;
}

// 缓存当前In18对应的key的position位置
class Cache {
    memories = [] as Array<{ code: string; positions: Position[] }>;
    addCache(code: string, positions: Position[]) {
        this.memories.push({
            code,
            positions
        });

        if (this.memories.length > 8) {
            this.memories.shift();
        }
    }
    getPositionsByCode(code: string) {
        const mem = this.memories.find(mem => mem.code === code);
        if (mem && mem.positions) {
            return mem.positions;
        }

        return false;
    }
}

const cache = new Cache();

/**
 * 获取所有语言包的配置
 * @returns
 */
export const getLanguageMap = (kiwiPath: string) => {
    try {
        const files = fs.readdirSync(kiwiPath);

        return files.reduce((total, item) => {
            // 因为require会缓存结果，导致每次结果都不更新，所以需要清除
            Object.keys(require.cache).forEach(function (key) {
                delete require.cache[key];
            });
            // @ts-ignore
            total[item] = require(`${kiwiPath}/${item}`);
            return total;
        }, {});
    } catch (e: any) {
        vscode.window.showErrorMessage(`获取配置错误,错误具体信息: ${e.message}`);
        return {}
    }
};

/**
 * 获取当前的语言
 * @returns
 */
export const getCurrentLanguage = () => {
    let language = 'zh-CN';

    try {
        const config = vscode.workspace.getConfiguration();
        const tongdun: Config | undefined = config.get('tongdun');
        language = tongdun ? tongdun.translation.language : '';
    } catch (e) {
        vscode.window.showErrorMessage('请先在设置里面配置语言包');
        return undefined;
    }

    return language;
};


/**
 * I18N 中文显示位置
 */
const annotationDecoration: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        margin: '0 0 0 3em',
        textDecoration: 'none'
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
} as vscode.DecorationRenderOptions);

/**
 * 转换位置
 * @param pos
 * @param editorText
 * @param toLastCol 是否是行尾
 */
export const transformPosition = (pos: Position, editorText: string, toLastCol?: boolean) => {
    const { start, code } = pos;

    const width = code.length;
    let lines, line, ch;
    if (start !== undefined) {
        lines = editorText.slice(0, start + 1).split('\n');
        /** 当前所在行 */
        line = (pos as any).line || lines.length - 1;
        /** I18N 开始的 col */
        ch = lines[line].length;
    } else {
        lines = editorText.split('\n');
        line = (pos as any).line;
        ch = lines[line].length;
    }
    let first, last;
    if (toLastCol) {
        const lineLastCol = _.get(editorText.split('\n'), [line, 'length']);
        first = new vscode.Position(line, lineLastCol);
        last = new vscode.Position(line, width + lineLastCol);
    } else {
        first = new vscode.Position(line, ch);
        last = new vscode.Position(line, ch + width);
    }
    return new vscode.Range(first, last);
}

/**
 * 设置行内提示
 * @param activeEditor
 */
export const setLineDecorations = (context: vscode.ExtensionContext, activeEditor: vscode.TextEditor) => {
    const code = activeEditor.document.getText();
    console.log(code)
    const positions = findI18NPositions(context, code);
    let decorations = [];
    decorations = (positions || []).map((pos: Position) => {
        const toLastCol = true;
        const range = transformPosition(pos, code, toLastCol);
        return {
            range,
            renderOptions: {
                after: {
                    color: '#999999',
                    contentText: `${pos.cn.replace('\n', ' \\n')}`,
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textDecoration: 'none;'
                }
            } as vscode.DecorationInstanceRenderOptions
        }
    });

    // @ts-ignore
    activeEditor.setDecorations(annotationDecoration, decorations);
}

/**
 * 查找 I18N 表达式
 * @param code
 */
export const findI18NPositions = (context: vscode.ExtensionContext, code: string) => {
    const cachedPoses = cache.getPositionsByCode(code);
    if (cachedPoses) {
        return cachedPoses;
    }
    const currentLanguage = context.globalState.get('currentLanguage');
    const languageMap = context.globalState.get('languageMap');
    // @ts-ignore
    const I18N = languageMap[currentLanguage];
    if (!I18N) {
        return []
    }

    const positions = [] as Position[];

    const regexMatches = getRegexMatches(I18N, code);
    let matchPositions = positions.concat(regexMatches);
    // @ts-ignore
    matchPositions = _.uniqBy(matchPositions, (position: Position & { line: number }) => {
        return `${position.code}-${position.line}`;
    });

    cache.addCache(code, matchPositions);
    return matchPositions;
}

/** 使用正则匹配{{}} */
const getRegexMatches = (I18N: string, code: string) => {
    const lines = code.split('\n');
    const positions: Position[] = [];
    /** 匹配{{I18N.}} */
    const reg = new RegExp(/I18N.(.*)/);
    const normalReg = new RegExp(/I18N.(.*)/);
    (lines || []).map((line, index) => {
        const match = reg.exec(line);
        let exps = _.get(match, [1]);
        if (!exps) {
            exps = _.get(normalReg.exec(line), [1]);
        }
        if (exps) {
            exps = exps.trim();
            exps = exps.split('}')[0];
            exps = exps.split(')')[0];
            exps = exps.split(',')[0];
            exps = exps.split(';')[0];
            exps = exps.split('"')[0];
            exps = exps.split("'")[0];
            exps = exps.split(' ')[0];
            const code = `I18N.${exps}`;
            const position = new Position();
            const transformedCn = _.get(I18N, exps.split('.'));
            if (typeof transformedCn === 'string') {
                position.cn = transformedCn;
                (position as any).line = index;
                position.code = code;
                positions.push(position);
            }
        }
    });
    return positions;
}

// /**
//  * 获取到翻译的结果
//  * @param {*} obj 翻译的映射
//  * @param {*} list 每一层的key
//  */
// export const getValue = <T extends Object>(obj: T, list: string[]) => {
//     try {
//         for (let i of list) {
//             if (Object.keys(obj).includes(i)) {
//                 // @ts-ignore
//                 obj = obj[i];
//             } else {
//                 return undefined;
//             }
//         }
//         return obj;
//     } catch (e) {
//         return '';
//     }
// };
