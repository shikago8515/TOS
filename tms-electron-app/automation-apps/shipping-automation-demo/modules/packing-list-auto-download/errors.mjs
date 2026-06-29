export function formatPackingListAutoDownloadError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const statusCode = Number(error?.statusCode || 500);

  if (/fileBase64|Excel|workbook|xlsx|xls|上传|文件/i.test(rawMessage)) {
    return {
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 400,
      stage: "自动下载箱单 Excel 校验",
      message: rawMessage,
      detail: "请确认上传的是自动下载箱单 Excel，并且文件不是空文件。",
    };
  }

  if (/账号|密码|credentials|Unauthorized/i.test(rawMessage)) {
    return {
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 400,
      stage: "自动下载箱单登录凭据",
      message: rawMessage,
      detail: "请先在页面保存 Infor Nexus 账号密码，再重新执行自动下载箱单。",
    };
  }

  return {
    statusCode,
    stage: "自动下载箱单",
    message: rawMessage || "自动下载箱单执行失败。",
    detail: "当前模块已实现 Infor Nexus 登录、打开 PackingManifestView.jsp，并填入 Excel 第一条 PO；箱单结果选择、下载和结果产物仍需继续在 packing-list-auto-download 模块内补充。",
  };
}
