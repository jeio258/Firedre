/**
 * 图表插件共享 CSS 类名常量
 *
 * 集中管理 rehype 插件（服务端）和客户端脚本共用的类名，
 * 修改类名时只需改这一处，避免 CSS / JS 不一致导致交互失效。
 */

// 容器
export const DIAGRAM_CONTAINER = "diagram-container";
export const DIAGRAM_WRAPPER = "diagram-wrapper";

// Mermaid
export const MERMAID_CONTAINER = "mermaid-diagram-container";
export const MERMAID_WRAPPER = "mermaid-wrapper";
export const MERMAID_SVG_LIGHT = "mermaid-svg-light";
export const MERMAID_SVG_DARK = "mermaid-svg-dark";
export const MERMAID_ERROR = "mermaid-error";
export const MERMAID_FALLBACK_CODE = "mermaid-fallback-code";

// PlantUML
export const PLANTUML_CONTAINER = "plantuml-diagram-container";
export const PLANTUML_WRAPPER = "plantuml-wrapper";
export const PLANTUML_IMAGE = "plantuml-image";

// Pan-zoom 交互
