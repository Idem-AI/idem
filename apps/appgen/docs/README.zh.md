[![English](https://img.shields.io/badge/README-English-494cad.svg)](https://github.com/idem appgen-dev/idem appgen/blob/main/README.md) [![中文](https://img.shields.io/badge/README-中文-494cad.svg)](https://github.com/idem appgen-dev/idem appgen/blob/main/docs/README.zh.md) 


# idem appgen

## 什么是 Idem Appgen

![alt tex t](./img/image-1.png)

## idem appgen 有什么不同之处？

目前 cursor 、v0、bolt.new 在 web 项目生成有比较惊艳的表现。idem appgen 项目有以下特点

- 支持浏览器运行调试，内置 WebContainer 环境可以让你在浏览器环境下运行终端，安装并运行 npm 和工具库
- 还原高保真设计图，运用行业前沿的 D2C 技术，支持 90%设计稿还原。
- 支持历史项目引入，相较于 bolt.new 它运行在浏览器的环境下。idem appgen 能够直接打开现有的历史项目，进行二次编辑和调试
- 打通微信小程序开发者工具，能够直接通过点击预览吊起微信开发者工具并进行调试。
- 支持chat模式和builder模式，builder模式用于代码生成和二次编辑查看预览，chat模式是一般的与大模型对话
- 多端支持 支持了 windows,mac 操作系统客户端下载，以及 web 容器运行场景，可以根据使用场景选用不同的终端

| 功能                   | idem appgen | v0  | bolt.new |
| ---------------------- | --- | --- | -------- |
| 代码生成和预览         | ✅  | ✅  | ✅       |
| 设计稿转代码           | ✅  | ✅  | ❌       |
| 开源                   | ✅  | ❌  | ✅       |
| 支持微信小程序工具预览 | ✅  | ❌  | ❌       |
| 是否支持已经存在的项目 | ✅  | ❌  | ❌       |
| 是否支持 deepseek      | ✅  | ❌  | ❌       |

## Get Started

本项目采用 pnpm 作为包管理工具，确保你的 nodejs 版本 在 18.20 以上

- 安装 pnpm

```bash
npm install pnpm -g
```

- 安装依赖

```bash
#客户端服务
cd apps/we-dev-client
pnpm install

# 后端服务
cd apps/we-dev-next
pnpm install

```

- 配置环境变量

.env.example 改名并且写入到 .env

前端 apps/we-dev-client/.env
```shell
# 服务端地址 必填 例如 http://localhost:3000
REACT_REACT_APP_BASE_URL=

# jwt 密钥 选填
JWT_SECRET=
```
后端服务 apps/we-dev-next/.env

```shell
# 第三方模型api 必填 例如 https://api.openai.com/v1
THIRD_API_URL=
# 第三方模型api key 必填 例如 sk-xxxx
THIRD_API_KEY=
# jwt 密钥 选填
JWT_SECRET=
```

**快速启动的办法**
支持在根目录快速启动

```bash
"dev:next": "cd apps/we-dev-next && pnpm install && pnpm dev",
"dev:client": "cd apps/we-dev-client  && pnpm dev",
```

## 构建脚本

```bash
chmod +x scripts/wedev-build.sh

./scripts/wedev-build.sh
```
## 如何安装使用

客户端版本如何使用？
  1. 进入到https://idem appgen.ai/ 页面
  2. 选择 Download for Mac  或 Windows下载二进制包
  3. 开始使用



## 联系我们

发送邮件到 <a href="mailto:enzuo@wegc.cn">enzuo@wegc.cn</a>

## 微信群交流群
<img src="./img/code.png" alt="alt text" width="200"/>

如果无法加入微信群，可以加

<img src="./img/self.png" alt="alt text" width="200"/>

## Star History

<a href="https://star-history.com/?utm_source=bestxtools.com#idem appgen-dev/idem appgen&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=idem appgen-dev/idem appgen&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=idem appgen-dev/idem appgen&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=idem appgen-dev/idem appgen&type=Date" />
 </picture>
</a>
