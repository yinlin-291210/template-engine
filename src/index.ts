import compiler, { Compiler } from "./personnalCompiler.improve";
// @ts-ignore
import testTemplate from "./testTemplate.json";
// @ts-ignore
import mustache from "mustache";
// @ts-ignore
import render from "./personnalCompiler";

let { templateStr, data } = testTemplate.pop();
console.log(templateStr);

// 个人实现模板引擎（初版）
console.log("-----个人实现模板引擎（初版）-----");
// console.log(render(templateStr, data));

// mustache官方结果
console.log("-----mustache官方结果-----");
console.log(mustache.render(templateStr, data));

// 个人实现模板引擎（改进版）
console.log("-----个人实现模板引擎（改进版）-----");
templateStr = templateStr.replaceAll("{{", "<^");
templateStr = templateStr.replaceAll("}}", "^>");
compiler.compilerAttributes.keyWords = ["<^", "^>"];
compiler.render(templateStr, data);
console.log(compiler);
console.log(compiler.result);

let { templateStr: templateStr1, data: data1 } = testTemplate.pop();
const compiler1 = new Compiler();
compiler1.render(templateStr1, data1);
console.log(compiler1);
console.log(compiler1.result);
