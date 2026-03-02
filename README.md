# DVC Extension for Visual Studio Code

![Version](https://img.shields.io/visual-studio-marketplace/v/lakefs.lakefs-dvc)
![Installs](https://img.shields.io/visual-studio-marketplace/i/lakefs.lakefs-dvc)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/lakefs.lakefs-dvc)
![Rating](https://img.shields.io/visual-studio-marketplace/r/lakefs.lakefs-dvc)

[![Continuous Integration](https://github.com/treeverse/vscode-dvc/actions/workflows/continuous-integration.yml/badge.svg)](https://github.com/treeverse/vscode-dvc/actions/workflows/continuous-integration.yml)
[![Maintainability](https://api.codeclimate.com/v1/badges/394dc6629c487ab8776c/maintainability)](https://codeclimate.com/github/treeverse/vscode-dvc/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/394dc6629c487ab8776c/test_coverage)](https://codeclimate.com/github/treeverse/vscode-dvc/test_coverage)

[Quick start](#quick-start) • [What you get](#what-you-get) •
[Commands](#useful-commands) • [Configuration](#configuration) •
[Debugging](#debugging) • [Contributing](#contributing) •
[Telemetry](#data-and-telemetry)

Run, compare, visualize, and track machine learning experiments right in VS
Code. This extension uses [DVC](https://dvc.org/), an open-source data
versioning and ML experiment management tool. No additional services or
databases are required.

🔔 Stay up-to-date with the latest product updates and tutorials by subscribing
to the [DVC YouTube channel](https://www.youtube.com/@dvcorg8370/videos)!

![Extension Overview](https://raw.githubusercontent.com/treeverse/vscode-dvc/main/extension/docs/overview.gif)

- **Experiment tracking**: Record training data, parameters, and metrics on top
  of [Git](https://git-scm.com/). Navigate your experiments, compare their
  results, and find the best ML models.
- **Visualization**: Plot performance data in a customizable dashboard including
  one or more overlaid experiments.
- **Live tracking**: Capture and see metrics changing in real time.
- **Reproducibility**: Make sure that anyone can recover or confirm previous
  experiments, and run new experiments based on their results.
- **Data Management**: Handle and version large datasets, files, and models
  effectively right from VS Code.

> **Note**: We always welcome feedback! Feel free to reach out [via Discord] or
> open [issues in GitHub].
>
> [issues in github]: https://github.com/treeverse/vscode-dvc/issues
> [via discord]: https://discord.gg/BGCjJHvDHt

### Why prefer this extension?

- Enjoy the best developer experience with the first experiment tracking
  interface for an IDE.
- No external servers, databases, subscriptions, etc. Data stays fully under
  your control and your existing Git hosting is used to share and collaborate.
- Go beyond a simple metrics dashboard with complete ML experiments that include
  metrics, code, and data. Powered by [DVC experiment
  versioning][dvc experiments].
- Implement [data versioning] on top of your favorite cloud storage, such as
  Amazon S3, Azure Blob Storage, Google Cloud Storage, NFS, etc.

[dvc experiments]:
  https://dvc.org/doc/user-guide/experiment-management/experiments-overview
[data versioning]: https://dvc.org/doc/use-cases/versioning-data-and-model-files

## Quick start

1. Install [this extension] in VS Code.
2. Follow the steps set out on the [Setup](#useful-commands) page!

<!-- prettier-ignore -->
> 💡 Feel free to try our [example DVC project] first! Opening it [with Github
> Codespaces] will include this extension automatically.

[this extension]:
  https://marketplace.visualstudio.com/items?itemName=lakeFS.lakefs-dvc
[example dvc project]:
  https://github.com/treeverse/example-get-started-experiments
[with github codespaces]:
  https://docs.github.com/en/codespaces/getting-started/quickstart#creating-your-codespace

### Learn more about DVC (Data Version Control)

See the DVC documentation to Get Started with [Experiments] or [Data
Management]. For deeper learning, try our [free course]! [More resources].

[experiments]: https://dvc.org/doc/start/experiments
[data management]: https://dvc.org/doc/start/data-management
[free course]: https://learn.dvc.org/
[more resources]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/more-resources.md

## What you get

This extension augments VS Code in the following ways:

- Adds a brand-new new **[DVC View]** (<img
  src="https://raw.githubusercontent.com/treeverse/vscode-dvc/main/extension/docs/dvc.png"
  alt="DVC logo" height="16"/> icon in the Activity Bar) with panels to
  visualize and manage [DVC Experiments].
- Provides special _Editors_ to manage **[Experiments]** and display **[Plots]**
  in IDE _Tabs_.
- Adds a **[DVC Tracked]** panel to the _Explorer_ view. This shows a tree of
  the data files and directories tracked by DVC, including their state, and
  options to [synchronize] them (from/to remote storage).
- Adds a **[DVC panel]** to the _Source Control_ view to display the [workspace
  status]. You can [restore] or reset project versions (based on the current Git
  `HEAD` commit) as well as manage new and existing data from here.
- Registers several **Commands** in the _[Command Palette]_ (see next section).
- Includes a DVC channel for the _Output_ panel (useful for
  [debugging](#debugging)).

[dvc view]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/view-container.md
[experiments]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/experiments-table.md
[plots]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/plots.md
[command palette]:
  https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette
[dvc tracked]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/dvc-tracked-files.md
[synchronize]: https://dvc.org/doc/start/data-management#storing-and-sharing
[dvc panel]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/dvc-tracked-files.md
[workspace status]:
  https://dvc.org/doc/command-reference/status#local-workspace-status
[restore]: https://dvc.org/doc/start/data-management#switching-between-versions

## Useful commands

Open the Command Palette (`F1` or ⇧⌃P on Windows/Linux or ⇧⌘P on macOS) and type
in one of the following commands:

| Command                 | Description                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DVC: Show Setup`       | Show the extension's setup page. Which can be used to setup the DVC project, view the walkthrough and more.    |
| `View: Show DVC`        | Open the extension's view container.                                                                           |
| `DVC: Show Experiments` | Show an interactive version of DVC's `exp show` [command](https://dvc.org/doc/command-reference/exp/show).     |
| `DVC: Show Plots`       | Show an interactive version of DVC's `plots diff` [command](https://dvc.org/doc/command-reference/plots/diff). |

Learn more about the extension's [commands].

[commands]:
  https://github.com/treeverse/vscode-dvc/blob/main/extension/resources/walkthrough/command-palette.md

## Configuration

These are the VS Code [settings] available for the Extension:

[settings]: https://code.visualstudio.com/docs/getstarted/settings

| **Option**                                  | **Description**                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dvc.dvcPath`                               | Path or shell command to the DVC binary. Required unless Microsoft's [Python extension] is installed and the `dvc` package found in its environment.     |
| `dvc.pythonPath`                            | Path to the desired Python interpreter to use with DVC. Should only be utilized when using a virtual environment without Microsoft's [Python extension]. |
| `dvc.experimentsTableHeadMaxHeight`         | Maximum height of experiment table head rows.                                                                                                            |
| `dvc.focusedProjects`                       | A subset of paths to the workspace's available DVC projects. Using this option will override project auto-discovery.                                     |
| `dvc.doNotInformMaxExperimentsPlotted`      | Do not inform when plotting more experiments is blocked (maximum number selected).                                                                       |
| `dvc.doNotShowSetupAfterInstall`            | Do not prompt to show the setup page after installing. Useful for pre-configured development environments.                                               |
| `dvc.doNotRecommendRedHatExtension`         | Do not prompt to install the Red Hat YAML extension, which helps with DVC YAML schema validation (`dvc.yaml` and `.dvc` files).                          |
| `dvc.doNotRecommendMermaidSupportExtension` | Do not prompt to install the Markdown Preview Mermaid Support extension, which helps to visualize DVC pipeline DAGs.                                     |
| `dvc.doNotShowCliUnavailable`               | Do not warn when the workspace contains a DVC project but the DVC binary is unavailable.                                                                 |

> **Note** that the `Setup The Workspace` command helps you set up the basic
> ones at the [Workspace level] (saved to `.vscode/setting.json`).

### Python

This extension is integrated with Microsoft's [Python extension]. When possible,
the Python extension's selected interpreter will be used to locate DVC. The
`PYTHONPATH` environment variable identified via the [python.envFile] config
setting is also respected.

[python extension]:
  https://marketplace.visualstudio.com/items?itemName=ms-python.python
[workspace level]:
  https://code.visualstudio.com/docs/getstarted/settings#_workspace-settings
[python.envFile]:
  https://code.visualstudio.com/docs/python/environments#_use-of-the-pythonpath-variable

## Debugging

### The DVC Extension

Please see the DVC [channel] in the IDE's _Output_ panel to see the underlying
DVC commands being run, as well as their error output. Feel free to share this
with us [via Discord] or use it to report [issues in GitHub].

[channel]:
  https://code.visualstudio.com/api/extension-capabilities/common-capabilities#output-channel

### Your DVC project

Due to the way DVC pipelines run scripts of any language from the command line,
users must debug pipeline scripts (e.g. `train.py`) standalone in whatever way
debuggers are run on the base language - this is standard for debugging DVC
pipelines, and most scripts are capable of running outside of DVC.

## Contributing

See the development and contributing guidelines in
[CONTRIBUTING.md](https://github.com/treeverse/vscode-dvc/blob/main/CONTRIBUTING.md).

![GitHub Contributors Image](https://contrib.rocks/image?repo=treeverse/vscode-dvc)

## Data and telemetry

The DVC Extension for Visual Studio Code collects usage data and sends it to
Azure to help improve our products and services. This extension respects the
`telemetry.enableTelemetry` setting which you can learn more about at
https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting.
