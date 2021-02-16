"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var React = __importStar(require("react"));
var ink_1 = require("ink");
var Item = function (_a) {
    var _b = _a.isSelected, isSelected = _b === void 0 ? false : _b, label = _a.label, color = _a.color, description = _a.description;
    return (React.createElement(ink_1.Box, { width: 100 },
        React.createElement(ink_1.Box, { width: 20 },
            React.createElement(ink_1.Text, { color: isSelected ? color : undefined },
                label,
                " ")),
        React.createElement(ink_1.Text, null,
            " ",
            isSelected ? description : "")));
};
exports.default = Item;
