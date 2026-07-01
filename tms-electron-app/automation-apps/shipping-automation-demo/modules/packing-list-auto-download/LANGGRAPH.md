# 自动下载箱单 LangGraph 接入说明

本模块已经从“外层包装执行”升级为真正的 LangGraph 状态图编排。

执行入口仍然是 `index.mjs`，但业务执行会进入 `langgraph-workflow.mjs`。原有 fragile Infor Nexus 页面操作仍保留在 `workflow.mjs`，以免重写 DOM 细节造成回归。

## 图节点

- `prepare-workbook`：解析并准备 NO / PO 批次。
- `create-request-session`：准备 Infor Nexus 登录会话。
- `open-packing-manifest`：启动可见浏览器并打开 `PackingManifestView.jsp`。
- `process-group`：按 NO 批次循环处理；每个 NO 内继续使用原有 PO 逐个搜索、详情打开、PDF 下载逻辑。
- `finalize`：汇总下载结果、写入 LangGraph metadata、关闭浏览器。
- `failed`：统一失败终态，保留错误说明并清理浏览器会话。

## 设计原则

- LangGraph 负责流程状态、循环控制、失败分支和清理。
- Playwright 仍然只在本机执行器中运行。
- 原 `runPackingListAutoDownloadWorkflow` 保留为兼容回退；当 `@langchain/langgraph` 不可用时，会回退到旧执行路径。
- 每个执行结果都会带 `langGraph` metadata，包含节点事件、状态、耗时和已处理批次数。

## 回退

接入前备份位于：

`backups/packing-list-auto-download-langgraph-20260630-223908`

执行该目录下的 `restore.ps1` 可以恢复到 LangGraph 接入前状态。

## 当前版本节点

当前箱单下载已经推进到 PO 操作级全链路图：

- `prepare-workbook`
- `create-request-session`
- `open-packing-manifest`
- `start-group`
- `apply-po-filter`
- `open-search-result`
- `download-pdf`
- `settle-po-attempt`
- `finish-group`
- `finalize`
- `failed`

其中 `apply-po-filter -> open-search-result -> download-pdf -> settle-po-attempt` 会在同一个 NO 内按 PO 顺序循环；任意一个 PO 成功下载 PDF 后，当前 NO 进入 `finish-group` 并继续下一个 NO。所有 PO 都失败时，当前 NO 会以失败结果归档，然后继续后续 NO。
