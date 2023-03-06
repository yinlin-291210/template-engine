export enum ErrorType {
  Paramater_EERROR = "paramater",
  TYPE_ERROR = "Type",
  TAG_ERROR = "Tag",
}

export type ParamaterErrorMessage = {
  paramater: string | string[];
  data: string;
};

export type TypeErrorMessage = {
  name: string;
  supposed: string | string[];
  nowType?: string;
};

export type TagErrorMessage = {
  tagName: "BeginTag" | "EndTag";
  value: string;
  from: number;
  end: number;
};

/**
 * @abstract 错误处理抽象类(策略模式)，子类在此基础上改写
 * @param {T} 需处理的 errors 数据结构泛型，限制入参
 * 可以使用表驱动或者反射实现策略模式，但无法在运行时校验类型，因为ts在运行时已经被编译为js，js不存在interface？（这句话有问题）
 */
export abstract class ErrorHandleAbstract<T> {
  abstract errorType: ErrorType;
  abstract getError(errors: T): ErrorHandleAbstract<T>;
  private _show!: (tips?: string) => Error;
  public message: string;
  constructor() {
    this.message = "";
  }

  private addMessageHead() {
    this.message = `[${this.errorType} Error]: ${this.message}`;
  }

  public show(tips?: string): Error {
    this.addMessageHead();
    if (tips) {
      this.message += `, [Tips]:${tips}`;
    }
    throw new Error(this.message);
  }
}

export class ParamaterErrorHandle extends ErrorHandleAbstract<ParamaterErrorMessage> {
  public errorType: ErrorType;
  constructor() {
    super();
    this.errorType = ErrorType.TYPE_ERROR;
  }

  getError(errors: ParamaterErrorMessage): ParamaterErrorHandle {
    let { paramater, data } = errors;
    if (paramater instanceof Array) {
      paramater = (paramater as string[]).join(" & ");
    }
    this.message += `can't find ${paramater} in ${data}`;
    return this;
  }
}

export class TypeErrorHandle extends ErrorHandleAbstract<TypeErrorMessage> {
  public errorType: ErrorType;
  constructor() {
    super();
    this.errorType = ErrorType.TYPE_ERROR;
  }

  getError(errors: TypeErrorMessage): TypeErrorHandle {
    let { name, supposed, nowType } = errors;
    if (supposed instanceof Array) {
      supposed = (supposed as string[]).join(" or ");
    }
    this.message += `${name} is supposed to be ${supposed} ${
      nowType ? `,but now is ${nowType}` : ""
    }`;
    return this;
  }
}

export class TagErrorHandle extends ErrorHandleAbstract<TagErrorMessage> {
  public errorType: ErrorType;
  constructor() {
    super();
    this.errorType = ErrorType.TAG_ERROR;
  }

  getError(errors: TagErrorMessage): TagErrorHandle {
    const { tagName, value, from, end } = errors;
    this.message += `error ${tagName} ${value} (${from},${end})`;
    return this;
  }
}
