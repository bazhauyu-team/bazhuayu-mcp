import type { EnumLabelMap } from './types.js';

const enumMap: EnumLabelMap = {
  AsyncExportFileStatus: {
    '0': '等待生成',
    '1': '生成中',
    '2': '已生成',
    '3': '已过期',
    '4': '生成失败'
  },
  AsyncExportFileType: {
    '0': 'EXCEL',
    '1': 'CSV',
    '2': 'HTML',
    '3': 'JSON',
    '4': 'XML',
    '5': 'GOOGLE_SHEETS',
    '6': 'ZAPIER_FILE',
    '7': 'ZIP',
    '8': 'MYSQL',
    '9': 'ORACLE',
    '10': 'SQL_SERVER',
    '11': 'POSTGRESQL'
  },
  StartTaskResult: {
    '0': '启动成功',
    '1': '已在运行',
    '2': '任务不存在',
    '4': '余额不足',
    '5': '任务被禁用',
    '6': '触发频率限制',
    '7': '未知错误',
    '1000': '用户不存在',
    '1001': '用户已暂停',
    '1002': '用户已过期',
    '1003': '用户权限不足',
    '1004': '用户积分不足'
  },
  TaskExecuteStatus: {
    '0': '未执行',
    '1': '等待中',
    '2': '执行中',
    '3': '停止中',
    '4': '已停止',
    '5': '已完成'
  },
  TaskRuleExecuteStatus: {
    '0': '运行中',
    '1': '已停止',
    '2': '已完成',
    '3': '等待中',
    '5': '就绪'
  },
  AccountLevelDto: {
    '1': '免费版',
    '2': '标准版',
    '3': '专业版',
    '4': '企业增强版',
    '9': '基础版',
    '31': '企业版',
    '110': '个人版',
    '120': '团队版',
    '130': '商业版',
    '140': '企业成员'
  },
  RunOn: {
    '1': '仅本地',
    '2': '云端',
    '3': '云端和本地'
  }
};

export default enumMap;
