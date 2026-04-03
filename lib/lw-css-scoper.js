/**
 * Scopes CSS selectors by prepending the component tag name.
 * @param {string} css - The CSS string to scope
 * @param {string} tagName - The custom element tag name (e.g., 'myapp-counter')
 * @returns {string} Scoped CSS
 */
export const scopeCss = (css, tagName) => {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '');

  return uncommented.replace(/([^{}]+)\{/g, (match, selectorBlock) => {
    const trimmed = selectorBlock.trim();

    if (trimmed.startsWith('@')) {
      return match;
    }

    if (/^(from|to|\d+%(\s*,\s*\d+%)*)$/.test(trimmed)) {
      return match;
    }

    const scopedSelectors = trimmed.split(',').map(sel => {
      sel = sel.trim();
      if (!sel) return sel;
      if (sel === ':host') return tagName;
      if (sel.startsWith(':host(')) {
        return tagName + sel.slice(5);
      }
      return `${tagName} ${sel}`;
    }).join(', ');

    return scopedSelectors + ' {';
  });
};
