declare module 'html2canvas';
declare module 'jspdf';

declare module '*.liquid' {
  const content: string;
  export default content;
}

declare module '*.liquid?raw' {
  const content: string;
  export default content;
}

declare module '*.json?raw' {
  const content: string;
  export default content;
} 