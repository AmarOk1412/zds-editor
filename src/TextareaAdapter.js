const { Pos, Range } = require('./util');
const keycode = require('keycode');
const { EventEmitter } = require('events');

/**
 * Adapter to use a standard textarea element
 * @class
 * @implements {GenericAdapter}
 * @extends {EventEmitter}
 */
class TextareaAdapter extends EventEmitter {
  /**
   * @constructor
   * @param {HTMLTextAreaElement} textarea
   */
  constructor(textarea) {
    if (!textarea || textarea.nodeName !== 'TEXTAREA') throw new Error('No textarea provided');
    super();

    /** @type {HTMLTextAreaElement} */
    this.textareaNode = textarea;
    /** @type {HTMLTextAreaElement} */
    this.toolbarNode = document.createElement('div');
    /** @type {HTMLDivElement} */
    this.wrapperNode = document.createElement('div');

    this.wrapperNode.className = 'editor-wrapper editor-textarea-adapter';
    this.toolbarNode.className = 'editor-toolbar';
  }

  /**
   * Called when the adapter is attached to the editor
   */
  attach() {
    if (this.textareaNode.parentNode) {
      this.textareaNode.parentNode.insertBefore(this.wrapperNode, this.textareaNode);
    }
    this.wrapperNode.appendChild(this.toolbarNode);
    this.wrapperNode.appendChild(this.textareaNode);

    this._keydownHandler = e => this.handleKeydown(e);
    this._pasteHandler = e => this.emit('paste', e);
    this._dropHandler = e => this.emit('drop', e);
    this.textareaNode.addEventListener('keydown', this._keydownHandler);
    this.textareaNode.addEventListener('paste', this._pasteHandler);
    this.textareaNode.addEventListener('drop', this._dropHandler);
  }

  /**
   * Called when the toolbar is changed
   * @param {Map.<string, object>} toolbar
   */
  setToolbar(toolbar, _toolbarNode = this.toolbarNode) {
    const toolbarNode = _toolbarNode;
    toolbarNode.innerHTML = '';
    const focusHandler = (wrapper, action) => () => {
      toolbarNode.classList[action]('active');
      wrapper.classList[action]('active');
    };

    for (const [name, meta] of toolbar) {
      const wrapper = document.createElement('div');
      wrapper.className = 'editor-button-wrapper';
      const button = document.createElement('button');
      button.innerHTML = name;
      button.className = `editor-button editor-button-${meta.type}`;
      if (meta.alt) button.title = meta.alt;
      button.addEventListener('click', () => this.emit('action', meta));
      button.addEventListener('focus', focusHandler(wrapper, 'add'));
      button.addEventListener('blur', focusHandler(wrapper, 'remove'));
      wrapper.appendChild(button);

      if (meta.children && meta.children.size > 0) {
        const childWrapper = document.createElement('div');
        childWrapper.className = 'editor-toolbar-children';
        this.setToolbar(meta.children, childWrapper);
        wrapper.appendChild(childWrapper);
      }

      toolbarNode.appendChild(wrapper);
    }
  }

  /**
   * Called when the keymap is changed
   * @param {Map.<string, object>} keymap
   */
  setKeymap(keymap) {
    this.keymap = keymap;
  }

  /**
   * Handle a keydown event
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    let keyStr = '';
    const modifiers = [
      { name: 'Cmd', key: 'metaKey' },
      { name: 'Ctrl', key: 'ctrlKey' },
      { name: 'Shift', key: 'shiftKey' },
      { name: 'Alt', key: 'altKey' },
    ];

    for (const { name, key } of modifiers) {
      if (event[key]) keyStr += `${name}-`;
    }

    const k = keycode(event);
    if (k) keyStr += k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();

    if (this.keymap.has(keyStr)) {
      const action = this.keymap.get(keyStr);
      if (typeof action === 'function') {
        const result = action.call();
        if (result !== false) event.preventDefault();
      } else {
        event.preventDefault();
        this.emit('action', action);
      }
    }
  }

  /**
   * Get the text inside the textarea
   * @return {string[]}
   */
  getLines() {
    return this.textareaNode.value.split('\n');
  }

  /**
   * Get the position for a given index
   * @param {number} index
   * @return {Pos}
   */
  getPosFromIndex(index) {
    const text = this.getLines();
    let charsBefore = 0;
    for (const i in text) {
      if (charsBefore + text[i].length + 1 > index) {
        return new Pos({
          line: parseInt(i, 10),
          ch: index - charsBefore,
        });
      }

      charsBefore += text[i].length + 1;
    }

    return new Pos({
      line: text.length - 1,
      ch: text[text.length - 1].length - 1,
    });
  }


  /**
   * Get the index for a given position
   * @param {Pos} pos
   * @return {number}
   */
  getIndexFromPos(pos) {
    const text = this.getLines();
    let n = 0;
    for (let i = 0; i < pos.line; i++) {
      n += text[i].length + 1;
    }
    return n + pos.ch;
  }

  listSelections() {
    return [new Range(
      this.getPosFromIndex(this.textareaNode.selectionStart || 0),
      this.getPosFromIndex(this.textareaNode.selectionEnd || 0)
    )];
  }

  focus() {
    this.textareaNode.focus();
  }

  getRange(range) {
    const text = this.getLines().slice(range.start.line, range.end.line + 1);
    text[text.length - 1] = text[text.length - 1].substring(0, range.end.ch);
    text[0] = text[0].substring(range.start.ch);
    return text.join('\n');
  }

  replaceRange(replacement, range) {
    if (document.queryCommandEnabled('insertText')) {
      this.setSelection(range);
      this.focus();
      document.execCommand('insertText', false, replacement);
    } else {
      const startIndex = this.getIndexFromPos(range.start);
      const endIndex = this.getIndexFromPos(range.end);
      const rawText = this.textareaNode.value;
      this.textareaNode.value = rawText.substring(0, startIndex)
        + replacement + rawText.substring(endIndex);
    }
  }

  setSelection(range) {
    this.textareaNode.setSelectionRange(
      this.getIndexFromPos(range.start),
      this.getIndexFromPos(range.end)
    );
  }

  getLine(line) {
    return this.getLines()[line];
  }

  getText() {
    return this.textareaNode.value;
  }

  setText(text) {
    this.textareaNode.value = text;
  }

  lock() {
    this.textareaNode.disabled = true;
  }

  unlock() {
    this.textareaNode.disabled = false;
  }

  /**
   * Destroy the instance
   */
  destroy() {
    this.removeAllListeners();

    this.textareaNode.removeEventListener('keydown', this._keydownHandler);
    this.textareaNode.removeEventListener('paste', this._pasteHandler);
    this.textareaNode.removeEventListener('drop', this._dropHandler);

    this.wrapperNode.removeChild(this.textareaNode);
    this.wrapperNode.removeChild(this.toolbarNode);
    if (this.wrapperNode.parentNode) {
      this.wrapperNode.parentNode.insertBefore(this.textareaNode, this.wrapperNode);
      this.wrapperNode.parentNode.removeChild(this.wrapperNode);
    }

    delete this.toolbarNode;
    delete this.wrapperNode;
  }
}

module.exports = TextareaAdapter;
