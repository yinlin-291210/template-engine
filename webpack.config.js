const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "none",
  devtool: "eval-cheap-module-source-map",
  entry: "./src/index.ts", // 指定入口文件
  output: {
    path: path.resolve(__dirname, "dist"), // 指定打包文件的目录
    filename: "bundle.js", // 打包后文件的名称
  },
  // 指定webpack打包时要使用的模块
  module: {
    // 指定loader加载的规则
    rules: [
      {
        test: /\.ts$/, // 指定规则生效的文件：以ts结尾的文件
        use: "ts-loader", // 要使用的loader
        exclude: /node-modules/, // 要排除的文件
      },
    ],
  }, // 设置哪些文件类型可以作为模块被引用
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "调试模板引擎", // 自定义title标签内容
      template: "./src/template.html", // 以template.html文件作为模板生成dist/index.html（设置了template，title就失效了）
    }),
  ],
};
