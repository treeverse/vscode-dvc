## Feedback

See something that should be changed? Want to request a new feature? Open an
[issue on GitHub](https://github.com/treeverse/vscode-dvc/issues)!

## Pull requests

You may also submit a change request to this repository directly
[from here](https://github.com/treeverse/vscode-dvc/pulls). Contributions are
highly appreciated!

> 💡 **Tip**: To enable formatting on save in VS Code, install the
> `esbenp.prettier-vscode` extension. This is highly recommended as PRs with
> improper format will be blocked from merge until fixed.

## Development environment

Setting up a dev environment allows contributors to test changes to this
extension. The source code is built, and the resulting package loaded into a
special instance of VS Code.

First, ensure that [Visual Studio Code](https://code.visualstudio.com) and
[Yarn](https://yarnpkg.com/) are installed.

- Open this repository as a project in VS Code and run `yarn install` from the
  _Integrated Terminal_.

- Run `Tasks: Run Build Task` (Shift + Ctrl/Cmd + `b`) to start the individual
  dev servers (alternatively, run `yarn dev-server` from the _Terminal_). The
  latest build is saved in `extension/dist`.

  > **Warning**: Having a separate `.vsix` version of this extension installed
  > may cause all kinds of chaos in your dev env.

- **Start Debugging** (F5) to open the [Extension Development Host], a child
  instance of VS Code with the local extension build installed.

  > **Note**: using the `Run Extension` configuration when running the debugger
  > will prevent all other extensions from loading into VS Code. This will
  > improve the performance of VS Code but can cause certain DVC commands to
  > fail if the DVC project uses an isolated Python env (see
  > [this warning](#warning)).

- Open a DVC project in the _Extension Development Host_. VS Code will remember
  the last project opened, so this step only has to be done once.

  > **Note**: We have provided a demo project as part of this repo, but feel
  > free to use any DVC project that you have available.

[extension development host]:
  https://code.visualstudio.com/api/working-with-extensions/testing-extension

<a id='warning'></a>

> **Warning**: When using any project that relies on an isolated Python
> environment (`conda`, `venv`, etc.), Microsoft's Python extension is required.
> It's used by this extension to locate and utilize the required environment.

## The demo project

The [demo project](https://github.com/treeverse/vscode-dvc-demo) is provided as
a lightweight, convenient testbed to try your changes to this extension.

> **Note**: It is not an exhaustive showcase of DVC's features. Testers are
> encouraged to try other DVC repositories -- especially real-world cases!

- Run `yarn setup:venv` from the _Terminal_ in the root of this repo to set up a
  Python virtual environment for the demo project (in `demo/.env`).

- Open the `./demo` project in a VS Code window, for example in the _Extension
  Development Host_ (see previous section).

- Pull the project data using this extension (either from the **DVC Tracked**
  panel in the _File Explorer_ or the **DVC panel** in _Source Control_) or by
  running `dvc pull` from _Terminal_.

- In order to [run experiments] in the demo project, the [Python extension]
  should be installed so that the virtual env is activated (see
  [full warning](#warning)).

[python extension]:
  https://marketplace.visualstudio.com/items?itemName=ms-python.python
[run experiments]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/run-experiments.md

## React component development with Storybook

Start Storybook with `yarn storybook` in either the root of this repo or in the
`webview` project. You can develop the React components this plugin uses without
requiring VS Code as a dev environment.

There are some discrepancies between the Storybook environment and the
environment of a real VS Code extension, custom themes being a big one. Always
make sure to try out changed components in the full dev environment before
merging!

## Adding and using icons (SVGs)

Before adding one or more icons, check the available icons in
`webview/src/shared/component/icons`. You can also start Storybook and verify
the icons' story to see all the icons at once. Try to pick one that's already
available before adding one.

If none of the icons fit the purpose, you can select one from
[VS Code codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html).
Once you know which icon you want to add, copy its name and add it to
`webview/icons/codicons.mjs` in the `codicons` constant. If, by some unfortunate
circumstance, none of the codicon meets your needs, you can add a custom SVG to
the `webview/icons` directory.

If you have added any icon (custom or from codicon), you will have to run
`yarn svgr` or `yarn install` to ensure the icon is now available in the
codebase.

To use an icon, import it from `webview/src/shared/components/icons` (from the
index file, not the file itself) and use it with the `<Icon />` component
filling its `icon` prop with your imported icon.
