import Bmob from "hydrogen-js-sdk";
// 从环境变量读取
const masterKey = import.meta.env.VITE_BMOB_MASTER_KEY;

// 初始化 Bmob
Bmob.initialize("0ba7d98f31845fab", "666666", masterKey);

export default Bmob;

// 辅助函数：上传文件
export const uploadFile = async (file: File) => {
  const params = Bmob.File(file.name, file);
  const res = await params.save();
  // Bmob 返回的文件地址通常是 http 的，为了兼容性，如果你的 App 强制 https，可能需要配置
  // 这里直接返回 url
  return JSON.parse(res as any).url;
};
