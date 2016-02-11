require('codemirror/mode/gfm/gfm');
const codemirror = require('codemirror');
import { Range } from './util';

/**
 * Adapter to use CodeMirror for the editor
 * @class
 * @implements {GenericAdapter}
 */
class CodeMirrorAdapter {
  constructor(textarea, options = { codemirror: {} }) {
    if (!textarea) throw new Error('No textarea provided');

    this.cm = codemirror.fromTextArea(textarea, Object.assign({
      mode: {
        name: 'gfm',
        gitHubSpice: false,
      },
      tabMode: 'indent',
      lineWrapping: true,
    }, options.codemirror));
  }

  setOptions(options) {
    if (options.keymaps) {
      this.cm.setOption('extraKeys', options.keymaps);
    }
  }

  listSelections() {
    return this.cm.listSelections().map(Range.fromCmRange);
  }

  focus() {
    this.cm.focus();
  }

  getRange(range) {
    return this.cm.getRange(range.start, range.end);
  }

  replaceRange(replacement, range) {
    this.cm.replaceRange(replacement, range.start, range.end);
  }

  setSelection(...selections) {
    const _selections = selections.map(sel => {
      if (sel.hasOwnProperty('start')) {
        return { anchor: sel.start, head: sel.end };
      }
      return { anchor: sel };
    });

    this.cm.setSelections(_selections);
  }

  getLine(line) {
    return this.cm.doc.getLine(line);
  }

  lock() {
    this.cm.setOption('readOnly', true);
  }

  unlock() {
    this.cm.setOption('readOnly', false);
  }

  getWrapperElement() {
    return this.cm.getWrapperElement();
  }

  on(event, callback, ...args) {
    return this.cm.on(event, (cm, e) => callback(e), ...args);
  }
}

export default CodeMirrorAdapter;