import Bmob from "hydrogen-js-sdk";

// 初始化 Bmob
// 请替换为你自己的 Secret Key 和 API 安全码
Bmob.initialize("1a4d990dc2323abdb780df15c8ba574e", "");

export default Bmob;

// 辅助函数：上传文件
export const uploadFile = async (file: File) => {
  const params = Bmob.File(file.name, file);
  const res = await params.save();
  // Bmob 返回的文件地址通常是 http 的，为了兼容性，如果你的 App 强制 https，可能需要配置
  // 这里直接返回 url
  return JSON.parse(res as any).url;
};
