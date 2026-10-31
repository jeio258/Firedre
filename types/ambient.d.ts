// 服务端类型补口：workerd 运行时提供、workers-types 未声明，或第三方子路径缺声明。
// 本文件必须保持「全局脚本」形态（无 import/export），否则 declare module 会退化为模块增强。

declare module "katex/dist/contrib/mhchem.mjs";

interface CacheStorage {
	default: {
		match(request: string | Request): Promise<Response | undefined>;
		put(request: string | Request, response: Response): Promise<void>;
		delete(request: string | Request): Promise<boolean>;
	};
}
