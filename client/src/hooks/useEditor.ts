import { useState, useCallback, useRef } from 'react';

export type EditorLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go';

interface EditorState {
  language: EditorLanguage;
  fontSize: number;
  theme: 'vs-dark' | 'light';
  wordWrap: boolean;
}

export function useEditor() {
  const [state, setState] = useState<EditorState>({
    language: 'javascript',
    fontSize: 14,
    theme: 'vs-dark',
    wordWrap: true,
  });

  const editorRef = useRef<any>(null);

  const setLanguage = useCallback((language: EditorLanguage) => {
    setState(prev => ({ ...prev, language }));
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    setState(prev => ({ ...prev, fontSize: Math.max(10, Math.min(28, fontSize)) }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState(prev => ({
      ...prev, theme: prev.theme === 'vs-dark' ? 'light' : 'vs-dark',
    }));
  }, []);

  const toggleWordWrap = useCallback(() => {
    setState(prev => ({ ...prev, wordWrap: !prev.wordWrap }));
  }, []);

  const getEditorValue = useCallback((): string => {
    return editorRef.current?.getValue() ?? '';
  }, []);

  return {
    ...state, editorRef,
    setLanguage, setFontSize, toggleTheme, toggleWordWrap, getEditorValue,
  };
}
