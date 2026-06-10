"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";

type RichTextEditorProps = {
  name: string;
  initialHtml?: string;
};

export function RichTextEditor({ name, initialHtml = "" }: RichTextEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "nofollow noreferrer",
          target: "_blank"
        }
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Placeholder.configure({
        placeholder: "请输入内容"
      })
    ],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      }
    },
    onUpdate({ editor: activeEditor }) {
      setHtml(activeEditor.getHTML());
    }
  });

  useEffect(() => {
    setHtml(initialHtml);
    if (editor && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, false);
    }
  }, [editor, initialHtml]);

  async function uploadImage(file: File): Promise<string> {
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
    return payload.url;
  }

  async function insertImageFiles(files: File[]) {
    for (const file of files) {
      const url = await uploadImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", previousUrl ?? "https://");
    if (url === null) {
      return;
    }
    if (!url.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="editor">
      <div className="editor-toolbar" aria-label="富文本工具栏">
        <button type="button" aria-label="正文" onClick={() => editor?.chain().focus().setParagraph().run()}>
          P
        </button>
        <button
          type="button"
          aria-label="标题 1"
          aria-pressed={editor?.isActive("heading", { level: 1 }) ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>
        <button
          type="button"
          aria-label="标题 2"
          aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="粗体"
          aria-pressed={editor?.isActive("bold") ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          aria-label="斜体"
          aria-pressed={editor?.isActive("italic") ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          aria-label="下划线"
          aria-pressed={editor?.isActive("underline") ?? false}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          U
        </button>
        <button
          type="button"
          aria-label="删除线"
          aria-pressed={editor?.isActive("strike") ?? false}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          S
        </button>
        <button
          type="button"
          aria-label="行内代码"
          aria-pressed={editor?.isActive("code") ?? false}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          {"</>"}
        </button>
        <button type="button" aria-label="引用" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          “”
        </button>
        <button type="button" aria-label="项目符号" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          •
        </button>
        <button type="button" aria-label="编号列表" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          1.
        </button>
        <button type="button" aria-label="左对齐" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
          L
        </button>
        <button type="button" aria-label="居中" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
          C
        </button>
        <button type="button" aria-label="右对齐" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
          R
        </button>
        <button type="button" aria-label="链接" onClick={setLink}>
          🔗
        </button>
        <button type="button" aria-label="取消链接" onClick={() => editor?.chain().focus().unsetLink().run()}>
          ⛓
        </button>
        <button type="button" aria-label="图片" onClick={() => fileInputRef.current?.click()}>
          🖼
        </button>
        <button
          type="button"
          aria-label="表格"
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          表
        </button>
        <button type="button" aria-label="增加行" onClick={() => editor?.chain().focus().addRowAfter().run()}>
          +行
        </button>
        <button type="button" aria-label="增加列" onClick={() => editor?.chain().focus().addColumnAfter().run()}>
          +列
        </button>
        <button type="button" aria-label="删除表格" onClick={() => editor?.chain().focus().deleteTable().run()}>
          删表
        </button>
        <button type="button" aria-label="代码块" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          Code
        </button>
        <button type="button" aria-label="分割线" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          —
        </button>
        <button type="button" aria-label="撤销" onClick={() => editor?.chain().focus().undo().run()}>
          ↶
        </button>
        <button type="button" aria-label="重做" onClick={() => editor?.chain().focus().redo().run()}>
          ↷
        </button>
        <label className="visually-hidden">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              if (files.length > 0) {
                void insertImageFiles(files);
              }
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <EditorContent editor={editor} className="editor-surface" />
      <textarea name={name} value={html} readOnly hidden />
    </div>
  );
}
