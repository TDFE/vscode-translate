/*
 * @Description: 公用方法
 * @Author: 郑泳健
 * @Date: 2022-05-27 18:22:28
 * @LastEditors: 郑泳健
 * @LastEditTime: 2022-07-01 17:29:41
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as _ from 'lodash';

interface Config {
    language?: string,
    color?: string,
    fontSize?: number;
}

class Position {
    start: number | undefined;
    cn: string | undefined;
    code: string | undefined;
}

interface LangMap {
    [key: string]: any
}

/**
 * 获取所有语言包的配置
 * @returns
 */
export const getLanguageMap = async (octopusPath: string, context: vscode.ExtensionContext) => {
    const octopusConf: Config | undefined = context.globalState.get('octopusConf');
    const lang: string = octopusConf?.language || 'zh-CN';
    try {
        const list = fs.readdirSync(`${octopusPath}/${lang}`);
        let langMap: LangMap = {};
        list.forEach((i: string) => {
            const suffixCheck = ['.js', '.ts', '.jsx', 'tsx'].some(it => i.endsWith(it));
            if (suffixCheck && !['index.js', 'index.jsx', 'index.ts', 'index.tsx'].includes(i)) {
                const str = fs.readFileSync(`${octopusPath}/${lang}/${i}`, 'utf-8');
                const replaceStr = str.replace(/export default|\;/g, '');
                const json = eval("(" + replaceStr + ")");
                const key = i.split('.')[0];
                langMap[key] = json;
            }
        });

        return {
            [lang]: langMap
        };
    } catch (e: any) {
        vscode.window.showErrorMessage(`获取配置错误,错误具体信息: ${e.message}`);
        return { [lang]: {} };
    }
};

/**
 * 获取当前的语言
 * @returns
 */
export const getOctopusConf = () => {
    try {
        const config = vscode.workspace.getConfiguration();
        const octopus: Config | undefined = config.get('octopus');
        return octopus;
    } catch (e) {
        vscode.window.showErrorMessage('请先在设置里面配置语言包');
        return {
            language: 'zh-CN'
        };
    }
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

    const width = code && code.length;
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
        const lineLastCol: number = _.get(editorText.split('\n'), [line, 'length']);
        first = new vscode.Position(line, lineLastCol);
        last = new vscode.Position(line, width ? width + lineLastCol : lineLastCol);
    } else {
        first = new vscode.Position(line, ch);
        last = new vscode.Position(line, width ? ch + width : ch);
    }
    return new vscode.Range(first, last);
};

/**
 * 设置行内提示
 * @param activeEditor
 */
export const setLineDecorations = (context: vscode.ExtensionContext, activeEditor: vscode.TextEditor) => {
    const code = activeEditor.document.getText();
    const octopusConf: Config | undefined = context.globalState.get('octopusConf');
    const positions = findI18NPositions(context, code);
    let decorations = [];
    decorations = (positions || []).map((pos: Position) => {
        const toLastCol = true;
        const range = transformPosition(pos, code, toLastCol);
        return {
            range,
            renderOptions: {
                after: {
                    color: octopusConf?.color || '#73935A',
                    contentText: `${pos && pos.cn && pos.cn.replace('\n', ' \\n')}`,
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textDecoration: 'none'
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
    const octopusConf: Config | undefined = context.globalState.get('octopusConf');
    const languageMap = context.globalState.get('languageMap');
    const lang = octopusConf?.language;
    // @ts-ignore
    const I18N = languageMap[lang];
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
    let positions: Position[] = [];

    (lines || []).map((line, index) => {
        const list = getPositionList(I18N, line, index, []);
        positions = [...positions, ...list];
    });
    return positions;
};

/** 如果一行有多个I18N的情况 */
const getPositionList = (I18N: string, line: string, index: number, list: Position[] = []) => {
    /** 匹配{{I18N.}} */
    const reg = new RegExp(/I18N.(.*)/);
    const normalReg = new RegExp(/I18N.(.*)/);
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
            list.push(position);
        }
    }
    if (_.get(match, [1])?.includes('I18N.')) {
        const arr = getPositionList(I18N, _.get(match, [1]) as string, index, []);
        list = [...list, ...arr];
    }
    return list;
};
