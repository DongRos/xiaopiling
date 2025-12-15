import AV from "leancloud-storage";

// --- 配置区域 ---
// 请去 LeanCloud 国际版控制台 -> 设置 -> 应用凭证 复制过来
const appId = "E6cMhcxUIcQAawpJQ5JDjU73-MdYXbMMI";
const appKey = "DLXm3DXlx7Iqilkl7iISKALt";
const serverURL = "https://api.liuyadong.dpdns.org"; // 例如 https://xxx.api.lncldglobal.com

AV.init({
  appId,
  appKey,
  serverURL,
});

export default AV;

// 封装上传函数：修复了之前 Bmob 上传失败卡死的问题
export const uploadFile = async (file: File): Promise<string> => {
  try {
    console.log(`[LeanCloud] 开始上传: ${file.name}`);
    const avFile = new AV.File(file.name, file);
    const savedFile = await avFile.save();
    
    // 获取 URL 并强制 HTTPS
    let url = savedFile.url();
    if (url && url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }
    console.log(`[LeanCloud] 上传成功: ${url}`);
    return url;
  } catch (error: any) {
    console.error("[LeanCloud] 上传失败:", error);
    // 返回空字符串，让前端知道失败了，从而移除预览图
    return "";
  }
};
