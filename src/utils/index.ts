/*
 * @Description: 公用方法
 * @Author: 郑泳健
 * @Date: 2022-05-27 18:22:28
 * @LastEditors: 郑泳健
 * @LastEditTime: 2022-05-30 15:07:17
 */
import * as vscode from 'vscode';
import * as fs from 'fs';

interface Language {
    language: string;
}

interface Config {
    translation: Language;
}

/**
 * 获取到翻译的结果
 * @param {*} obj 翻译的映射
 * @param {*} list 每一层的key
 */
export const getValue = <T extends Object>(obj: T, list: string[]) => {
    try {
        for (let i of list) {
            if (Object.keys(obj).includes(i)) {
                // @ts-ignore
                obj = obj[i];
            } else {
                return undefined;
            }
        }
        return obj;
    } catch (e) {
        return '获取失败';
    }
};

/**
 * 获取所有语言包的配置
 * @returns
 */
export const languageMap = () => {
    // @ts-ignore
    const rootPath = vscode.workspace.workspaceFolders[0].uri.path;
    const files = fs.readdirSync(rootPath + '/.kiwi');

    return files.reduce((total, item) => {
        // @ts-ignore
        total[item] = require(rootPath + `/.kiwi/${item}`);
        return total;
    }, {});
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
        return undefined;
    }

    return language;
};
