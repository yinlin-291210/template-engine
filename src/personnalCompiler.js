// 个人实现mustache-tokens,但是对象

const KEY_TEXT = Symbol("text");
const KEY_CONTENNT = Symbol("content");
const KEY_NAME = Symbol("name");
const KEY_ARR = Symbol("#");
const KEY_END = Symbol("/");
const tagRe = /\<(\w+)\>/g;
const nameRe = /\{\{([\s\S]*?)\}\}/g;
let keyWordArr = ["{{", "}}"];
let tail = "";
let tokens = {};
let currentRe = "<";
let testIndex = 1;
let fromIndex = 0;
let stack = [];
let treeDep = [];

function rest(tags) {
  keyWordArr = tags || keyWordArr;
  tail = "";
  tokens = {};
  currentRe = "<";
  testIndex = 1;
  fromIndex = 0;
  stack = [];
  treeDep = [];
}

export default function render(templateStr, data) {
  return renderTokens(getTokens(templateStr), data);
}

export function getTokens(templateStr) {
  rest();
  tail = templateStr;
  while (tail.trim()) {
    const token = {};
    // 给当前token设置属性
    const { key, match, content, tag } = testChunk();
    token.value = match;
    token.key = key;
    token.content = content;
    token.tag = tag;
    token.from = fromIndex;
    token.end = match.length + fromIndex;
    spliceTokens(token);
    fromIndex = token.end;
  }
  return tokens;
}

export function renderTokens(tokens, data) {
  let renderHtml = "";
  const splitToken = function (parentToken, token) {
    if (!token) {
      return;
    }
    if (parentToken.key === KEY_ARR || parentToken.belong === KEY_ARR) {
      token.belong = KEY_ARR;
      token.belongDataStack = parentToken.belongDataStack;
      token.indexStack = parentToken.indexStack;
    }
    const getData = function (token) {
      let belongData = data;
      if (token.belongDataStack) {
        for (let i = 0; i < token.belongDataStack.length; i++) {
          const stack = token.belongDataStack[i];
          const index = token.indexStack[i];
          belongData = (belongData || data)[stack][index];
        }
      }
      return belongData[token.tag];
    };
    switch (token.key) {
      case KEY_TEXT:
      case KEY_CONTENNT:
        renderHtml += token.value;
        for (let i in token.children) {
          splitToken(token, token.children[i]);
        }
        break;
      case KEY_ARR:
        for (let i = 0; i < (getData(token) || []).length; i++) {
          for (let j in token.children) {
            if (!token.indexStack) {
              token.indexStack = [];
              token.belongDataStack = [];
            }
            token.indexStack.push(i);
            token.belongDataStack.push(token.tag);
            splitToken(token, token.children[j]);
            token.belongDataStack.pop();
            token.indexStack.pop();
          }
        }
        break;
      case KEY_NAME:
        const { tag } = token;
        const [f, e] = keyWordArr;
        renderHtml += token.value.replace(
          `${f}${tag}${e}`,
          getData(token) || ""
        );
    }
    if (token.endValue) {
      renderHtml += token.endValue;
    }
  };
  for (let i in tokens) {
    splitToken(tokens, tokens[i]);
  }
  return renderHtml;
}

function confrimRe() {
  const str = tail.trim();
  // 截出模板字符串
  if (str.substring(0, 2) === keyWordArr[0]) {
    currentRe = keyWordArr[1];
  }
  // 在有模板时截出普通字符串
  else if (
    str.search(keyWordArr[0]) !== -1 &&
    (str.search(keyWordArr[0]) < str.search("<") || str.search("<") === -1)
  ) {
    currentRe = keyWordArr[0];
  }
  // 截出标签
  else if (str[0] === "<") {
    currentRe = ">";
  }
  // 在没有模板时截出普通字符串
  else {
    currentRe = "<";
  }
}

function testChunk() {
  confrimRe();
  const match = scanUtil(currentRe);
  const tokenObj = scanName(match);
  // console.log(`第${testIndex}次测试`);
  // console.log(`当前要正则所匹配字符串--${currentRe}`);
  // console.log(`当前要被分析的字符串--${match}`);
  // console.log(`剩余的字符串--${tail}`);
  // console.log(`当前栈`, stack);
  // console.log(`根据被分析字符串拆分的obj`, { ...tokenObj, match });
  // console.log(`当前tokens`, tokens);
  // console.log(`当前treeDep`, treeDep);
  testIndex++;
  return { ...tokenObj, match };
}

function checkStack(token) {
  return token.content || [KEY_NAME].includes(token.key);
}

function closeTagMethod() {
  stack.pop();
  while (stack.length + 1 < treeDep.length) {
    treeDep.pop();
  }
  // for (let i = stack.length + 1; i < treeDep.length; i++) {
  //   treeDep.pop();
  // }
  treeDep[stack.length] += 1;
}

function spliceTokens(token) {
  checkStack(token) && stack.push(token.tag);
  let treeDepIndex = stack.length - 1;
  if (token.value.includes("/")) {
    // 给节点添加结束标签
    let fa = tokens;
    for (let i = 0; i < treeDep.length - 1; i++) {
      fa = (fa.children || fa)[treeDep[i]];
    }
    const lastDepIndex = treeDep[treeDep.length - 1] - 1;
    fa = (fa.children || fa)[lastDepIndex];
    fa.endValue = fa.key !== KEY_ARR && token.value;
    return;
  }
  if (treeDep[treeDepIndex] === undefined) {
    treeDep[treeDepIndex] = 0;
  }
  // treeDepIndex为当前需挂载的深度，index为当前需挂载行数
  const index = treeDep[treeDepIndex];
  // 如果是深度为0即最外层节点则直接挂载
  if (!treeDepIndex) {
    tokens[index] = token;
  } else {
    // 寻找当前节点的父节点
    let fa = tokens;
    for (let i = 0; i < treeDep.length - 1; i++) {
      // 父节点所在行
      const faIndex = treeDep[i];
      fa = (fa.children || fa)[faIndex];
      fa.children = fa.children || {};
    }
    fa.children[index] = token;
  }
  checkStack(token) && closeTagMethod();
}

function scanName(match) {
  if (match.includes("/")) {
    // debugger;
  }
  match = match.trim();
  if (match.includes("/")) {
    closeTagMethod();
    return {
      key: KEY_END,
    };
  } else if (match.match(tagRe)) {
    let tag;
    match.replace(tagRe, (findStr, $1) => {
      stack.push($1);
      tag = $1;
      return $1;
    });
    return {
      key: KEY_TEXT,
      tag: tag,
    };
  } else if (match.match(nameRe)) {
    let obj;
    match.replace(nameRe, (findStr, $1) => {
      let tag = $1;
      switch ($1[0]) {
        case "#":
          tag = $1.substring(1, $1.length);
          stack.push(tag);
          obj = {
            key: KEY_ARR,
            tag,
          };
          return $1;
        default:
          obj = {
            key: KEY_NAME,
            tag,
          };
          return $1;
      }
    });
    return obj;
  } else {
    return {
      content: match,
      key: KEY_CONTENNT,
      tag: "",
    };
  }
}

function scanUtil(re) {
  const index = tail.search(re);
  let cutIndex = index + re.length;
  let match = "";
  switch (index) {
    case -1:
      match = tail;
      tail = "";
      break;
    case 0:
      break;
    default:
      if (re === "<" || re === keyWordArr[0]) {
        cutIndex = index;
      }
      match = tail.substring(0, cutIndex);
      tail = tail.substring(cutIndex);
  }

  return match;
}
