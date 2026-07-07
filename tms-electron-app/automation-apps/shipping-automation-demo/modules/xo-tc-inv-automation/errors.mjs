export function formatTcInvAutomationError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const statusCode = Number(error?.statusCode || 500);

  if (/fileBase64|Excel|workbook|xlsx|xls|工作表|数据行|上传|Invoice#/i.test(rawMessage)) {
    return {
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 400,
      stage: "TC INV Excel 校验",
      message: rawMessage,
      detail: "请确认上传的是 TC INV 出货明细 Excel，并且第一行表头包含 Invoice#，下面至少有一个有效发票号。",
    };
  }

  if (/账号|密码|credentials|Unauthorized/i.test(rawMessage)) {
    return {
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 400,
      stage: "TC INV 登录凭据",
      message: rawMessage,
      detail: "请先在页面保存 Infor Nexus 账号密码，再重新执行 TC INV 自动化。",
    };
  }

  return {
    statusCode,
    stage: "TC INV 自动化",
    message: rawMessage || "TC INV 自动化执行失败。",
    detail: "当前阶段会登录 Infor Nexus，进入 Invoices，按 Excel 的 Invoice# 查询并打开详情页；如果失败，请查看执行器日志和截图。",
  };
}
