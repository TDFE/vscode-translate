import * as vscode from 'vscode';
import { getLanguageMap, getCurrentLanguage, setLineDecorations } from './utils/index';

export function activate(context: vscode.ExtensionContext) {
    // @ts-ignore
    const kiwiPath = vscode.workspace.workspaceFolders[0].uri.path + '/.kiwi';
    // 获取当前工程的所有语言包,放到globalState
    context.globalState.update('languageMap', getLanguageMap(kiwiPath));
    // 获取当前的语言
    context.globalState.update('currentLanguage', getCurrentLanguage());

    let activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        setLineDecorations(context, activeEditor)
    }

    // 切换文档时候重新获取当前文档中的中文文案
    const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            setLineDecorations(context, editor)
        }
    })

    // 当文档内容发生变化时候重新检测文档中的中文文案
    const changeTextDocument = vscode.workspace.onDidChangeTextDocument((evnet) => {
        if (activeEditor && evnet.document === activeEditor.document) {
            setLineDecorations(context, activeEditor)
        }
    })

    // 监听设置里面的配置是否有更新
    vscode.workspace.onDidChangeConfiguration(function (event) {
        const configList = ['tongdun'];
        const affected = configList.some(item => event.affectsConfiguration(item));
        if (affected) {
            context.globalState.update('currentLanguage', getCurrentLanguage());
        }
    });

    // 监听.wiki文件夹的内容更改
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(kiwiPath, '**/*.js'), false, false, false);

    watcher.onDidChange(e => { // 文件发生更新
        context.globalState.update('languageMap', getLanguageMap(kiwiPath));
        if (activeEditor) {
            setLineDecorations(context, activeEditor)
        }
    });

    watcher.onDidCreate(e => { // 新建了js文件
        context.globalState.update('languageMap', getLanguageMap(kiwiPath));
        if (activeEditor) {
            setLineDecorations(context, activeEditor)
        }
    });

    watcher.onDidDelete(e => { // 删除了js文件
        context.globalState.update('languageMap', getLanguageMap(kiwiPath));
        if (activeEditor) {
            setLineDecorations(context, activeEditor)
        }
    });

    context.subscriptions.push(changeActiveTextEditor);
    context.subscriptions.push(changeTextDocument);

    // 这是悬浮时候显示文本内容
    // const disposable = vscode.languages.registerHoverProvider(['json', 'javascript', 'typescript'], {
    //     provideHover(document, position) {
    //         const fileName = document.fileName;

    //         // 获取一整行的内容
    //         const lineText = document.getText(new vscode.Range(
    //             position.line,
    //             0,
    //             position.line,
    //             500
    //         ));

    //         // 如果是.kiwi文件夹或者这一行没有I18N这个字符就没有提示
    //         if (fileName.includes('.kiwi') || !lineText.includes('I18N')) {
    //             return undefined;
    //         }

    //         let paths: string[] = [];

    //         const currentLanguage = context.globalState.get('currentLanguage');

    //         if (!currentLanguage) {
    //             return new vscode.Hover('请先在vscode设置里面配置语言');
    //         }

    //         try {
    //             // @ts-ignore
    //             const matchPath = lineText.match(/I18N[a-zA-Z.0-9]*/g) ? lineText.match(/I18N[a-zA-Z.0-9]*/g)[0] : '';
    //             paths = matchPath.split('.');
    //             paths.shift();
    //         } catch (e) {
    //             paths = [];
    //         }

    //         // 获取当前的语言包
    //         const languageMap = context.globalState.get('languageMap');

    //         if (languageMap) {
    //             // @ts-ignore
    //             const value = getValue(languageMap[currentLanguage], paths);
    //             return new vscode.Hover(value ? String(value) : `当前语言为${currentLanguage},匹配不到对应的key`);
    //         }

    //         return undefined;
    //     }
    // });
}

export function deactivate(context: vscode.ExtensionContext) {
    context.globalState.update('languageMap', {});
    context.globalState.update('currentLanguage', '');
}
