import { useEffect } from "react";

type MathJaxHub = {
  Config: (config: unknown) => void;
  Queue: (command: unknown[]) => void;
};

type MathJaxWindow = Window & {
  MathJax?: {
    Hub: MathJaxHub;
  };
};

const MATHJAX_SCRIPT_ID = "mathjax-script";

export function useMathJax(dependencyKey: string) {
  useEffect(() => {
    const currentWindow = window as MathJaxWindow;
    if (currentWindow.MathJax || document.getElementById(MATHJAX_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = MATHJAX_SCRIPT_ID;
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      currentWindow.MathJax?.Hub.Config({
        tex2jax: { inlineMath: [["$", "$"], ["\\(", "\\)"]] },
      });
      currentWindow.MathJax?.Hub.Queue(["Typeset", currentWindow.MathJax.Hub]);
    };
  }, []);

  useEffect(() => {
    const currentWindow = window as MathJaxWindow;
    if (!currentWindow.MathJax || !dependencyKey) {
      return;
    }

    window.setTimeout(() => {
      currentWindow.MathJax?.Hub.Queue(["Typeset", currentWindow.MathJax.Hub]);
    }, 0);
  }, [dependencyKey]);
}
