/**
 * 改进版模板引擎
 * 优化点：
 * - 做成面向对象，方便复用
 * - 改成ts版
 * - 添加一些错误提示
 * - 优化匹配方式
 * - 优化掉stack，仅用treeDep描述树
 * - 优化renderToken函数
 * - 优化冗余/丑陋代码
 * - 支持条件渲染
 * @returns 使用建造者模式，考虑扩展并方便链式调用
 */

import {
  ParamaterErrorHandle,
  TagErrorHandle,
  TypeErrorHandle,
} from "./handleError";

enum KeyType {
  // xxxx
  KEY_TEXT = "text",
  // <div>
  KEY_LABEL = "label",
  // <br/>
  KEY_LABEL2 = "label2",
  // {{name}}
  KEY_NAME = "name",
  // {{#arr}}
  KEY_ARR = "#",
  // </div>
  KEY_END = "/",
}

type Tokens = {
  [propName: string]: VNode<KeyType>;
};

type BasicVNode = {
  end: number;
  from: number;
  value: string;
  props?: {
    [propName: string]: string | number | boolean;
  };
};

type TextVNode = {
  content: string;
};

type NameVNode = {
  name: string;
};

type hasChildrenVNode = {
  childrens?: Tokens;
};

type LabelVNode = {
  label: string;
} & hasChildrenVNode;

type VNode<T extends KeyType> = (T extends KeyType.KEY_TEXT
  ? TextVNode
  : T extends KeyType.KEY_NAME
  ? NameVNode
  : T extends KeyType.KEY_ARR
  ? hasChildrenVNode & NameVNode
  : T extends KeyType.KEY_LABEL | KeyType.KEY_LABEL2
  ? LabelVNode
  : BasicVNode) & {
  type?: T;
  endValue?: string;
} & BasicVNode;

function getVnode<T extends KeyType>(...arg: [VNode<T>]): VNode<T> {
  return arg[0];
}

let compilerAttributes: any = {};

export class Compiler {
  static readonly _htmlOtherRe = "\\s*.-:''=";
  /** 永远不会被匹配到 */
  static readonly _neverRe = "[]|^[]";
  public tokens!: Tokens;
  public result!: string;
  public compilerAttributes!: {
    reMap: Map<KeyType, RegExp>;
    keyWords: [string, string];
    labelWords?: string[];
    InstructionsIf?: string;
  };

  [propName: string]: any;

  constructor() {
    this.reset();
  }

  reset() {
    this.compilerAttributes = {
      keyWords: ["{{", "}}"],
      /** html */
      labelWords: ["<", ">"],
      InstructionsIf: "l-if",
      reMap: new Map(),
    };
  }

  private renderReset(): Compiler {
    this.compilerAttributes.reMap = new Map();
    this.tokens = {};
    this.result = "";
    Object.values(KeyType).forEach((v) => {
      this.compilerAttributes.reMap.set(v, this.getRe(v));
    });
    compilerAttributes = this.compilerAttributes;
    return this;
  }

  private getTokens(templateStr: string): Compiler {
    const scanner = new Scanner(templateStr);
    this.tokens = scanner.renderTokens();
    return this;
  }

  private renderResult(data: any): Compiler {
    if (!(data instanceof Object)) {
      new TypeErrorHandle()
        .getError({
          name: "data",
          supposed: "Object",
        })
        .show();
    }
    this.result = new TokensToRes().splitTokens(this.tokens, data).result;
    return this;
  }

  render(
    templateStr: string,
    data: {
      [propName: string]: any;
    }
  ): string {
    this.renderReset().getTokens(templateStr).renderResult(data);
    return this.result;
  }

  private splitRe(
    f?: string | string[],
    e?: string | string[],
    otherChar: string = ".-:"
  ): string {
    const varRe = "\\w";
    let re = Compiler._neverRe;
    const splitReVal = (f: string, e: string): string => {
      /** 需转义元字符 */
      const needEscape = "^$.*+?|/()[]{}-";
      [f, e, otherChar] = [f, e, otherChar].map((str) =>
        str
          .split("")
          .map((e) => {
            if (needEscape.includes(e)) {
              return `\\${e}`;
            } else {
              return e;
            }
          })
          .join("")
      );
      return `${f}([${varRe}${otherChar}]+)${e}`;
    };
    if (f instanceof Array && e instanceof Array && f.length === e.length) {
      re = "";
      for (let i = 0; i < f.length; i++) {
        re += `${this.splitRe(f[i], e[i], otherChar)}|`;
      }
      return re.substring(0, re.length - 1);
    } else if (f && e) {
      return splitReVal(f as string, e as string);
    } else {
      return re;
    }
  }

  private getRe(key: KeyType): RegExp {
    const [labelF, labelE] =
      (this.compilerAttributes.labelWords instanceof Array &&
        this.compilerAttributes.labelWords) ||
      [];
    const [keyF, keyE] = this.compilerAttributes.keyWords;
    switch (key) {
      case KeyType.KEY_LABEL:
        return new RegExp(this.splitRe(labelF, labelE, Compiler._htmlOtherRe));
      case KeyType.KEY_LABEL2:
        if (labelF === "<" && labelE === ">") {
          return new RegExp(
            this.splitRe(labelF, `/${labelE}`, Compiler._htmlOtherRe)
          );
        }
        break;
      case KeyType.KEY_END:
        const fWords = [`${keyF}/`];
        const eWords = [keyE];
        if (
          labelF &&
          labelE &&
          [labelF, labelE].every((label) => typeof label === "string")
        ) {
          fWords.unshift(`${labelF}/`);
          eWords.unshift(labelE);
        }
        return new RegExp(this.splitRe(fWords, eWords));
      case KeyType.KEY_ARR:
        return new RegExp(
          this.splitRe(`${keyF}#`, keyE, Compiler._htmlOtherRe)
        );
      case KeyType.KEY_NAME:
        return new RegExp(this.splitRe(keyF, keyE));
    }
    return new RegExp(this.splitRe());
  }
}

class Scanner {
  private tail: string;
  constructor(templateStr: string) {
    this.tail = templateStr;
  }

  renderTokens() {
    const writer = new Writer();
    while (this.tail) {
      const currentKey = this.confirmRe();
      let currentRe = new RegExp(Compiler._neverRe);
      if (currentKey) {
        currentRe = compilerAttributes.reMap.get(currentKey)!;
      }
      const match = this.scanUtil(currentRe);
      writer.buildTokens(match, currentKey);
    }
    return writer.tokens;
  }

  confirmRe(): KeyType | undefined {
    const str = this.tail;
    // 找出tail中最近的需要解析的匹配规则
    const { reMap } = compilerAttributes;
    return [...reMap.keys()]
      .sort((a, b) => {
        const indexA =
          str.search(reMap.get(a)) === -1 ? 2 ** 53 : str.search(reMap.get(a));
        const indexB =
          str.search(reMap.get(b)) === -1 ? 2 ** 53 : str.search(reMap.get(b));
        return indexA - indexB;
      })
      .shift();
  }

  scanUtil(re: RegExp) {
    const match: RegExpMatchArray | { index: number } = this.tail.match(re) || {
      index: -1,
    };
    const index = match.index!;
    let cutIndex = 0;
    let value = "";
    switch (index) {
      case -1:
        value = this.tail;
        this.tail = "";
        return value;
      case 0:
        cutIndex = (match as RegExpMatchArray)[0].length;
        break;
      /** case!==0说明前面有普通字符串 */
      default:
        cutIndex = index;
    }
    value = this.tail.substring(0, cutIndex);
    this.tail = this.tail.substring(cutIndex);
    return value;
  }
}

class Writer {
  public tokens: Tokens;
  private treeDep: number[];
  private fromIndex: number;
  constructor() {
    this.tokens = {};
    this.treeDep = [0];
    this.fromIndex = 0;
  }
  private strToToken(match: string, currentKey?: KeyType): VNode<KeyType> {
    const basicVnode: BasicVNode = {
      value: match,
      from: this.fromIndex,
      end: this.fromIndex + match.length - 1,
    };
    let vNode = getVnode(basicVnode);
    let $1;
    if (currentKey) {
      $1 = match.match(compilerAttributes.reMap.get(currentKey)!);
    }
    if ($1) {
      vNode.type = currentKey;
      if (currentKey !== KeyType.KEY_END) {
        const attributes = $1[1].split(" ");
        const topName = attributes.shift()!;
        const props: {
          [key: string]: any;
        } = {};
        attributes.forEach((attribute: string) => {
          const [key, value] = attribute.split("=");
          if (!value) {
            props[key] = true;
          } else {
            props[key] =
              value === "false"
                ? false
                : value === "true"
                ? true
                : value.replace(/'/g, "");
          }
        });
        switch (currentKey) {
          case KeyType.KEY_LABEL:
          case KeyType.KEY_LABEL2:
            vNode = getVnode({
              ...basicVnode,
              label: topName,
              props,
            });
            break;
          case KeyType.KEY_ARR:
          case KeyType.KEY_NAME:
            vNode = getVnode({
              ...basicVnode,
              name: topName,
              props,
            });
            break;
        }
      }
    } else {
      vNode = getVnode({
        ...basicVnode,
        type: KeyType.KEY_TEXT,
        content: match,
      });
    }
    this.fromIndex = vNode.end + 1;
    return vNode;
  }

  private spliceTokens(token: VNode<KeyType>) {
    /** 当前tokens最大深度 */
    const treeDepIndex = this.treeDep.length - 1;
    /** token应挂载位置 */
    const index = this.treeDep[treeDepIndex];
    /** 最大深度为0，直接挂载到最外层 */
    if (!treeDepIndex) {
      this.tokens[index] = token;
    } else {
      let fa = this.tokens[this.treeDep[0]] as any;
      for (let i = 1; i < treeDepIndex; i++) {
        fa = fa.childrens![this.treeDep[i]];
      }
      fa.childrens = fa.childrens || {};
      if (token.type === KeyType.KEY_END) {
        // 校验闭标签
        const endRe = compilerAttributes.reMap.get(token.type);
        const endMatch = token.value.match(endRe!)!;
        let needError = false;
        switch (fa.type) {
          case KeyType.KEY_LABEL:
            if (endMatch[1] !== fa.label) {
              needError = true;
            }
            break;
          case KeyType.KEY_ARR:
            if (endMatch[2] !== fa.name) {
              needError = true;
            }
            break;
        }
        if (needError) {
          new TagErrorHandle()
            .getError({
              tagName: "EndTag",
              value: token.value,
              from: token.from,
              end: token.end,
            })
            .show();
        }
        fa.endValue = token.value;
      } else {
        fa.childrens[index] = token;
      }
    }
    /** 操作栈准备下次迭代 */
    switch (token.type) {
      /** 开始标签入栈 */
      case KeyType.KEY_LABEL:
      case KeyType.KEY_ARR:
        this.treeDep.push(0);
        break;
      /** 闭标签出栈，出栈后最大深度值+1 */
      case KeyType.KEY_END:
        this.treeDep.pop();
        this.treeDep[treeDepIndex - 1] += 1;
        break;
      /** 未进栈的一般字符串，有隐形出入栈的动作，需要将最大深度值+1 */
      default:
        this.treeDep[treeDepIndex] += 1;
    }
  }

  buildTokens(match: string, currentKey?: KeyType) {
    this.spliceTokens(this.strToToken(match, currentKey));
  }
}

class TokensToRes {
  public result: string;
  public data!: any;
  constructor() {
    this.result = "";
  }

  private handleProps(token: any, data: any, fromArray = false) {
    let res = "";
    for (let key in token.props) {
      let value = token.props[key];
      if (fromArray && key !== compilerAttributes.InstructionsIf) {
        new TagErrorHandle()
          .getError({
            tagName: "BeginTag",
            value: token.name,
            from: token.from,
            end: token.end,
          })
          .show(`includes surplus paramater ${key}`);
      }
      if (key === compilerAttributes.InstructionsIf || key[0] === ":") {
        let needOverAll = true;
        if (
          typeof key === "string" &&
          typeof value === "string" &&
          value.substring(0, 5) === "item."
        ) {
          value = value.substring(5);
          needOverAll = false;
        }
        const backValue = this.getData(value, data, needOverAll);
        if (backValue === undefined) {
          let remindData = data;
          if (needOverAll) {
            remindData = this.data;
          }
          if (key !== compilerAttributes.InstructionsIf) {
            new ParamaterErrorHandle()
              .getError({
                paramater: value,
                data: JSON.stringify(remindData),
              })
              .show();
          }
        }

        if (key === compilerAttributes.InstructionsIf) {
          if (!backValue) {
            return false;
          }
        } else {
          res += ` ${key.substring(1)}="${backValue}"`;
        }
      } else if (typeof value === "boolean" && value) {
        res += ` ${key}`;
      } else {
        res += ` ${key}="${value}"`;
      }
    }
    return res;
  }

  private recurseToken(token: any, data: any, fromArray = false) {
    if (!token) {
      return;
    }
    const recurse = (data: any) => {
      for (let i in token.childrens || {}) {
        this.recurseToken(token.childrens[i], data, true);
      }
    };
    switch (token.type) {
      case KeyType.KEY_ARR:
        const arr = this.getData(token.name!, data);
        if (arr && !(this.handleProps(token, data, true) === false)) {
          if (arr instanceof Array) {
            for (let i = 0; i < arr.length; i++) {
              recurse(arr[i]);
            }
          } else {
            new TypeErrorHandle()
              .getError({
                name: "arr",
                supposed: "Array",
                nowType: typeof arr,
              })
              .show();
          }
        }
        break;
      case KeyType.KEY_NAME:
        let replaceData = this.getData(token.name!, data);
        if (token.name === "." && fromArray) {
          replaceData = data;
        }
        this.result += token.value.replace(
          compilerAttributes.reMap.get(token.type)!,
          replaceData || ""
        );
        break;
      case KeyType.KEY_LABEL:
      case KeyType.KEY_LABEL2:
        let result = `${compilerAttributes.labelWords![0]}${token.label}`;
        let propsResult = this.handleProps(token, data);
        if (propsResult === false) {
          return;
        } else if (typeof propsResult === "string") {
          result += propsResult;
        }
        result += `${token.type === KeyType.KEY_LABEL2 ? "/" : ""}${
          compilerAttributes.labelWords![1]
        }`;
        this.result += token.value.replace(
          compilerAttributes.reMap.get(token.type)!,
          result || ""
        );
        recurse(data);
        break;
      default:
        this.result += token.value;
        recurse(data);
    }
    if (token.endValue && token.type !== KeyType.KEY_ARR) {
      this.result += token.endValue;
    }
  }

  private getData(key: keyof any, data: any, needOverAll = false): any {
    if (needOverAll) {
      if (typeof key === "string" && key.substring(0, 5) === "item.") {
        key = key.substring(5);
      } else {
        data = this.data;
      }
    }
    const isOriginal = (data: any) => {
      return ["number", "string", "undefined", "boolean", "symbol"].includes(
        typeof data
      );
    };
    let value;
    if (isOriginal(data)) {
      value = data;
    } else if (typeof key === "boolean") {
      value = key;
    } else if (data[key] instanceof Function) {
      value = (data[key] as any)();
    } else {
      value = data[key];
    }
    return value;
  }

  splitTokens(tokens: Tokens, data: any): TokensToRes {
    this.data = data;
    for (let i in tokens) {
      this.recurseToken(tokens[i], data);
    }
    return this;
  }
}

const compiler = new Compiler();

export default compiler;
