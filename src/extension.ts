/*
 * @Description: 入口
 * @Author: 郑泳健
 * @Date: 2022-07-01 09:38:57
 * @LastEditors: 郑泳健
 * @LastEditTime: 2022-07-01 14:24:54
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { getLanguageMap, getCurrentLanguage, setLineDecorations } from './utils/index';

export async function activate(context: vscode.ExtensionContext) {
    // @ts-ignore
    const octopusPath = vscode.workspace.workspaceFolders[0].uri.path + '/.octopus';

    if (!fs.existsSync(octopusPath)) {
        return;
    }

    // 获取当前工程的所有语言包,放到globalState
    context.globalState.update('languageMap', await getLanguageMap(octopusPath, context));
    // 获取当前的语言
    context.globalState.update('currentLanguage', getCurrentLanguage());

    let activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        setLineDecorations(context, activeEditor);
    }

    // 切换文档时候重新获取当前文档中的中文文案
    const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            setLineDecorations(context, editor);
        }
    });

    // // 当文档内容发生变化时候重新检测文档中的中文文案
    // const changeTextDocument = vscode.workspace.onDidChangeTextDocument((evnet) => {
    // if (activeEditor && evnet.document === activeEditor.document) {
    //         setLineDecorations(context, activeEditor);
    //     }
    // });

    // 监听设置里面的配置是否有更新
    vscode.workspace.onDidChangeConfiguration(async function (event) {
        const configList = ['tongdun'];
        const affected = configList.some(item => event.affectsConfiguration(item));
        if (affected) {
            context.globalState.update('currentLanguage', getCurrentLanguage());
            context.globalState.update('languageMap', await getLanguageMap(octopusPath, context));
            if (activeEditor) {
                setLineDecorations(context, activeEditor);
            }
        }
    });

    // 监听.octopus文件夹的内容更改
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(octopusPath, '**/*.js'), false, false, false);

    watcher.onDidChange(async e => { // 文件发生更新
        context.globalState.update('languageMap', await getLanguageMap(octopusPath, context));
        if (activeEditor) {
            setLineDecorations(context, activeEditor);
        }
    });

    watcher.onDidCreate(async e => { // 新建了js文件
        context.globalState.update('languageMap', await getLanguageMap(octopusPath, context));
        if (activeEditor) {
            setLineDecorations(context, activeEditor);
        }
    });

    watcher.onDidDelete(async e => { // 删除了js文件
        context.globalState.update('languageMap', await getLanguageMap(octopusPath, context));
        if (activeEditor) {
            setLineDecorations(context, activeEditor);
        }
    });

    context.subscriptions.push(changeActiveTextEditor);
    // context.subscriptions.push(changeTextDocument);
}

export function deactivate(context: vscode.ExtensionContext) {
    context.globalState.update('languageMap', {});
    context.globalState.update('currentLanguage', '');
}
