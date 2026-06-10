"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";

type RichTextEditorProps = {
  name: string;
  initialHtml?: string;
};

export function RichTextEditor({ name, initialHtml = "" }: RichTextEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: initialHtml,
    immediatelyRender: false,
    onUpdate({ editor: activeEditor }) {
      setHtml(activeEditor.getHTML());
    }
  });

  useEffect(() => {
    setHtml(initialHtml);
  }, [initialHtml]);

  async function uploadImage(file: File) {
    const form = new FormData();
    form.set("image", file);
    const response = await fetch("/api/uploads/image", {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      throw new Error("Image upload failed");
    }
    const payload = (await response.json()) as { url: string };
    editor?.chain().focus().setImage({ src: payload.url }).run();
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          I
        </button>
        <label className="button-link">
          图片
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void uploadImage(file);
              }
            }}
          />
        </label>
      </div>
      <EditorContent editor={editor} className="editor-surface" />
      <textarea name={name} value={html} readOnly hidden />
    </div>
  );
}

