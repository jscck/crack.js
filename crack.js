const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

var matchOperatorsRe = /[|\\{}()\[\]^$+*?\.]/g;
var escapeRegString = function (str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  return str.replace(matchOperatorsRe, '\\$&');
};



function repeat(ele, num) {
  var arr = new Array(num);
  for (var i = 0; i < num; i++) {
    arr[i] = ele;
  }

  return arr;
};

/**
 * 混淆函数关键字
 */
let methodSymbol = [
  '===',
  '==',
  'instanceof',
  '!==',
  '!=',
  '-',
  '<',
  '>',
  '<=',
  '>=',
  '&',
  'in'
];


var _0x2c19 = []; // 这里是字典
var _0x27c8 = function (x, c) {
  x = x - 0;
  var e = _0x2c19[x];
  return e
};

var replaceVar = (str) => {
  var rules = [
    { // 替换字典函数
      exec: () => {
        return new RegExp('_0x27c8\\("([a-z0-9]+)"\\)', 'g')
      },
      replace: () => {
        return function (match, $1) {
          return `"${_0x27c8($1)}"`;
        }
      }
    },
    ...repeat({
      // 替换别名变量，预执行 如 r["hJymj"] = "HBOuD"; 所有匹配变量 变成 "HBOuD"
      match: () => {
        return new RegExp('[a-z_]\\["[a-zA-Z]+"\\]\\s+=\\s+"[\\s\\S]*?"', 'g')
      },
      exec: (str) => {
        return new RegExp(escapeRegString(str) + '(?!\\s=)', 'g');
      }
    }, 20)];
  rules.forEach(function (item) {
    if (item.match) { // 替换别名变量
      let mas = str.match(item.match());
      let mqs = [];
      if (mas) {
        mas.forEach((value) => {
          let subs = value.split(' = ');
          mqs.push(subs);
          let subs1 = subs.slice(0);
          // a["zzzz"] => a.zzzz
          subs1[0] = subs1[0].replace('["', '.').replace('"]', '');
          mqs.push(subs1)
        })
      }
      mqs.forEach((ritem) => {
        str = str.replace(item.exec(ritem[0]), ritem[1])
      })
    } else {
      str = str.replace(item.exec(), item.replace());
    }
  })
  return str;
}

/**
 * 查询函数
 * @param {*} str 字符串
 * @param {*} regex 函数开始标志
 * @param {array} splits 分隔符
 * @param {*} callback 查询loop回调
 */
var searchScope = (str, funcstart, splits, callback) => {
  let splitstart = splits[0];
  let splitend = splits[1];
  let match;
  while (match = funcstart.exec(str)) {
    let level = 0;
    let left = match.index;
    let right = 0;
    let closed = false;
    while (left = left + 1) {
      if (str[left] == splitstart) {
        level++;
        closed = false;
      }
      if (str[left] == splitend) {
        level--;
        closed = true;
      }
      if (level == 0 && closed) {
        right = left;
        break;
      }
    }
    callback({ match, funcstart, right });
  }
}

/**
 * 获取调用函数参数，返回数组
 * @param {*} str 
 * @example  
 * ```
 * 
 *  t["eyXPW"]("object", t["eyXPW"](void 0, x) ? "undefined" : t["XUIJK"](l, x))
 * 
 *  返回 ["object", 't["eyXPW"](void 0, x) ? "undefined" : t["XUIJK"](l, x)']
 * 
 * ```
 */
var getArgs = (str) => {
  let cloneStr = str;
  let args = [];
  let funcstart = new RegExp('([^\\(,\\s])+?(?=\\()', 'g');
  searchScope(str, funcstart, ["(", ")"], function({ match, right}){
    let current = str.slice(match.index, right + 1);
    str = str.replace(current, repeat("*",current.length).join(''))
  })
  let spliter = /,\s?/g;
  let start = 0;
  let match;
  while(match = spliter.exec(str)) {
      args.push(cloneStr.slice(start, match.index))
      // update split index
      start = spliter.lastIndex;
  }
  // last substring
  args.push(cloneStr.slice(start))
  return args;
}



/**
 * 查找函数对象
 * @param {*} str 字符串
 * @param {*} reg 函数开始标志
 * @param {*} splits 分隔符
 */
var findFunc = (str) => {
  let funcstart = new RegExp('(\\b[a-z_]\\["[a-zA-Z]{5}"\\])\\s*=\\s*function', 'g');
  let match;
  let arr = [];
  while (match = funcstart.exec(str)) {
    let level = 0;
    let left = match.index;
    let right = 0;
    let closed = false;
    while (left = left + 1) {
      if (str[left] == "{") {
        level++;
        closed = false;
      }
      if (str[left] == "}") {
        level--;
        closed = true;
      }
      if (level == 0 && closed) {
        right = left;
        break;
      }
    }
    let current = str.slice(match.index, right + 1);
    let funcName = str.slice(match.index, funcstart.lastIndex + 1).split(' = ')[0];
    let aliasFunc = funcName.replace('["', '.').replace('"]', '');
    methodSymbol.forEach((opera) => {
      if (new RegExp('\\s' + escapeRegString(opera) + '\\s').test(current)) {
        arr.push([funcName, opera]);
        arr.push([aliasFunc, opera]);
      }
    })
    // 存在  x(), x(a), x(a, b) x(a, b, c)
    // 复合函数
    if (/return [a-z_]\([a-zA-Z_,\s]*\)/.test(current)) {
      arr.push([funcName, 'call', current]);
      arr.push([aliasFunc, 'call', current]);
    }
  }
  return arr;
}

/**
 * 替换函数
 * @param {*} str 
 */
var replaceFunc = (str) => {
  let arrMix = findFunc(str);
  arrMix.forEach((reItem) => {
    let funcstart = new RegExp(escapeRegString(reItem[0]) + '(?=\\()', 'g');
    let match;
    let arr = [];
    while (match = funcstart.exec(str)) {
      let level = 0;
      let left = match.index;
      let right = 0;
      let closed = false;
      while (left = left + 1) {
        if (str[left] == "(") {
          level++;
          closed = false;
        }
        if (str[left] == ")") {
          level--;
          closed = true;
        }
        if (level == 0 && closed) {
          right = left;
          break;
        }
      }
      let current = str.slice(match.index, right + 1);
      let args = current.replace(reItem[0], '').replace(/^\(/, '').replace(/\)$/, '');
      // 复合函数
      // t["eyXPW"]("object", t["eyXPW"](void 0, x) ? "undefined" : t["XUIJK"](l, x))
      let argz = getArgs(args);      
      if (reItem[1] == 'call') {
        let firstArg = argz.slice(0, 1);
        let restArg = argz.slice(1);
        if(restArg.length) {
          str = str.replace(current, firstArg + '(' + restArg.join(', ') + ')');
        } else {
          str = str.replace(current, firstArg + '()');
        }
      } else {
        argz.splice(1, 0, reItem[1])
        str = str.replace(current, argz.join(' '));
      }
      
    }
  })
  return str;
}

/**
 * 移除函数
 * @param {*} str 
 */
var removeFunc = (str) => {
  let funcstart = new RegExp('(\\b[a-z_]\\["[a-zA-Z]{5}"\\])\\s*=\\s*function', 'g');
  let match;
  while (match = funcstart.exec(str)) {
    let level = 0;
    let left = match.index;
    let right = 0;
    let closed = false;
    while (left = left + 1) {
      if (str[left] == "{") {
        level++;
        closed = false;
      }
      if (str[left] == "}") {
        level--;
        closed = true;
      }
      if (level == 0 && closed) {
        right = left;
        break;
      }
    }
    let current;
    let currentDot = str.slice(right + 1, right + 2);
    if (currentDot == ';' || currentDot == ',') {
      current = str.slice(match.index, right + 2);
    } else {
      current = str.slice(match.index, right + 1);
    }
    str = str.replace(current, '');
  }
  return str;
}
/**
 * 移除变量 
 * @param {*} str 
 * @example r["hJymj"] = "HBOuD";
 */
var removeVar = (str) => {
  let funcstart = new RegExp('[a-z_]\\["[a-zA-Z]{5}"\\]\\s+=\\s+"[\\s\\S]*?"', 'g');
  let match;
  while (match = funcstart.exec(str)) {
    let right = funcstart.lastIndex;
    let current = str.slice(match.index, right + 1);
    let currentDot = str.slice(right + 1, right + 2);
    if (currentDot == ';') {
      current = str.slice(match.index, right + 2);
    }
    str = str.replace(current, '');
  }
  return str;
}
/**
 * 移除空行
 * @param {*} str 
 */
var removeEmptyLine = (str) => {
  let funcstart = /^\s*[\r\n]/gm;
  let match;
  while (match = funcstart.exec(str)) {
    let right = funcstart.lastIndex;
    let current = str.slice(match.index, right + 1);
    str = str.replace(current, '');
  }
  return str;
}
/**
 * 转换变量 
 * @param {*} str 
 * @example Object["defineProperty"] => Object.defineProperty
 */
var convertVar = (str) => {
  let funcstart = new RegExp('\\["[a-zA-Z_]+"\\]', 'g');
  let match;
  while (match = funcstart.exec(str)) {
    let right = funcstart.lastIndex;
    let current = str.slice(match.index, right + 1);
    let newCurrent = current.replace('["', '.').replace('"]', '');
    str = str.replace(current, newCurrent);
  }
  return str;
}



function main() {
  let sourcePath = 'source/bug-unpack.js';
  let crackName = 'dist/crack-' + Date.now() + '.js';

  let template = fs.readFileSync(path.resolve(__dirname, sourcePath), 'utf-8').toString();
  repeat('', 2).forEach(() => {
    template = replaceVar(template);
  })

  repeat('', 3).forEach(() => {
    template = replaceFunc(template);
  })
  // 打扫现场
  repeat('', 20).forEach(() => {
    template = removeFunc(template);
  })
  repeat('', 20).forEach(() => {
    template = removeVar(template);
  })

  template = removeEmptyLine(template);

  // 转换变量
  repeat('', 2).forEach(() => {
    template = convertVar(template);
  })

  fs.writeFileSync(path.resolve(__dirname, crackName), template);

  spawn('prettier-eslint', ['--write', crackName]);
};


main();
