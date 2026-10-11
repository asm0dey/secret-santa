// Open dialogs and sheets register here so Telegram's BackButton closes the topmost one before it navigates.
/** @type {(() => void)[]} */
const stack = [];

/** @param {() => void} close @returns {() => void} unregister */
export function onBackClose(close) {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Closes the topmost overlay. @returns {boolean} whether there was one */
export function closeTopOverlay() {
  const close = stack.pop();
  close?.();
  return !!close;
}
