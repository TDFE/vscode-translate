import * as vscode from 'vscode';
import { getValue, languageMap, getCurrentLanguage } from './utils/index';

export function activate(context: vscode.ExtensionContext) {
    // 获取当前工程的所有语言包
    const map = languageMap();
    // 获取当前的语言
    const currentLanguage: string | undefined = getCurrentLanguage();

    const disposable = vscode.languages.registerHoverProvider(['json', 'javascript', 'typescript'], {
        provideHover(document, position) {
            const fileName = document.fileName;

            // 获取一整行的内容
            const lineText = document.getText(new vscode.Range(
                position.line,
                0,
                position.line,
                500
            ));

            // 如果是.kiwi文件夹或者这一行没有I18N这个字符就没有提示
            if (fileName.includes('.kiwi') || !lineText.includes('I18N')) {
                return undefined;
            }

            let paths: string[] = [];

            if (!currentLanguage) {
                return new vscode.Hover('请先在vscode设置里面配置语言');
            }

            try {
                // @ts-ignore
                const matchPath = lineText.match(/I18N[a-zA-Z.0-9]*/g) ? lineText.match(/I18N[a-zA-Z.0-9]*/g)[0] : '';
                paths = matchPath.split('.');
                paths.shift();
            } catch (e) {
                paths = [];
            }

            // @ts-ignore
            const value = getValue(map[currentLanguage], paths);
            return value ? new vscode.Hover(String(value)) : undefined;
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
