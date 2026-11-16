/** Camera commands for the toolbar buttons and keys, which live outside the canvas. The 3D bench fills them in once it has loaded; until then they do nothing.
    Kept apart from the scene so the page can offer them without loading three.js. */
export const view = { fit() {}, top() {}, zoom(_factor: number) {} };
