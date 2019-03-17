'use strict';
function repeat(ele, num) {
  var arr = new Array(num);
  for (var i = 0; i < num; i++) {
    arr[i] = ele;
  }

  return arr;
};

module.exports = (str) => {
		let cloneStr = str;
		let args = [];
		// 
	  let funcstart = new RegExp('([^\\(,\\s])+?(?=\\()', 'g');
    let match;
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
			// console.info('innner : ',current);
			str = str.replace(current, repeat("*",current.length).join(''))
		}

	let spliter = /,\s?/g;
	let start = 0;
	while(match = spliter.exec(str)) {
			args.push(cloneStr.slice(start, match.index))
			start = spliter.lastIndex;
	}
	args.push(cloneStr.slice(start))
	// console.info('scope:', cloneStr);
	// console.info('args: ', args);
	return args;
};