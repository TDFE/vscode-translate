/*
 * @Description: 公用方法
 * @Author: 郑泳健
 * @Date: 2022-05-27 18:22:28
 * @LastEditors: 郑泳健
 * @LastEditTime: 2022-06-30 10:18:46
 */
require('ts-node').register({
    compilerOptions: {
        module: 'commonjs'
    }
});

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as shell from 'shelljs';
import * as path from 'path';

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

/**
 * 获取所有语言包的配置
 * @returns
 */
export const getLanguageMap = async (octopusPath: string, context: vscode.ExtensionContext) => {
    const lang: string = context.globalState.get('currentLanguage') || 'zh-CN';
    try {
        await shell.rm('-rf', path.resolve(__dirname, '../temp'));
        await shell.cp(
            '-R',
            `${octopusPath}/${lang}/`,
            path.resolve(__dirname, '../temp')
        );

        const filelist = getNeedChangeNameFileList(path.resolve(__dirname, '../temp'), '.js');

        await changeFileSuffix(filelist, '.js', '.ts');
        Object.keys(require.cache).forEach(function (key) {
            delete require.cache[key];
        });
        const { default: langValue } = require(path.resolve(__dirname, '../temp/index.ts'));
        return {
            [lang]: langValue
        };
    } catch (e: any) {
        vscode.window.showErrorMessage(`获取配置错误,错误具体信息: ${e.message}`);
        return {};
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
};

/**
 * 设置行内提示
 * @param activeEditor
 */
export const setLineDecorations = (context: vscode.ExtensionContext, activeEditor: vscode.TextEditor) => {
    const code = activeEditor.document.getText();

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
        };
    });

    // @ts-ignore
    activeEditor.setDecorations(annotationDecoration, decorations);
};

/**
 * 查找 I18N 表达式
 * @param code
 */
export const findI18NPositions = (context: vscode.ExtensionContext, code: string) => {
    const currentLanguage = context.globalState.get('currentLanguage');
    const languageMap = context.globalState.get('languageMap');
    // @ts-ignore
    const I18N = languageMap[currentLanguage];
    if (!I18N) {
        return [];
    }

    const positions = [] as Position[];

    const regexMatches = getRegexMatches(I18N, code);
    let matchPositions = positions.concat(regexMatches);
    // @ts-ignore
    matchPositions = _.uniqBy(matchPositions, (position: Position & { line: number }) => {
        return `${position.code}-${position.line}`;
    });

    return matchPositions;
};

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
};

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

/**
 * 动态修改文件名
 * @param {*} filelist 需要修改后缀的文件列表, 每一项都不带后缀 string[]
 * @param {*} originSuffix 原后缀
 * @param {*} changedSuffix 新后缀
 */
const changeFileSuffix = (filelist: string[], originSuffix: string, changedSuffix: string) => {
    return Promise.all(filelist.map((fileName) => {
        console.log(fileName);
        fs.renameSync(fileName + originSuffix, fileName + changedSuffix);
    }));
};

/**
 * 递归获取所有要修改名字的目录
 * @param {*} path 要翻译的目录
 * @param {*} originSuffix 要翻译的文件原后缀
 * @param {*} fileList 返回哪些文件要修改后缀
 * @returns
 */
const getNeedChangeNameFileList = (path: string, originSuffix: string, fileList: string[] = []) => {
    const files = fs.readdirSync(path);

    files.forEach(function (file) {
        const stat = fs.statSync(path + '/' + file);
        if (stat.isDirectory()) {
            getNeedChangeNameFileList(path + '/' + file, originSuffix, fileList);
        }
        if (stat.isFile() && file.endsWith(originSuffix)) {
            // 去掉文件后缀，因为后面还要转回来
            const filename = file.substring(0, file.lastIndexOf('.'));
            fileList.push(`${path}/${filename}`);
        }
    });

    return fileList;
};
