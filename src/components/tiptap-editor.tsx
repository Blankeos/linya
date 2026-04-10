import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { Editor, Extension } from "@tiptap/core"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion"
import tippy, { type Instance as TippyInstance } from "tippy.js"

// ─── Slash command items ───────────────────────────────────────────────────────

interface SlashItem {
  title: string
  shortcut?: string
  keywords: string[]
  icon: string // HTML string
  command: (params: { editor: Editor; range: { from: number; to: number } }) => void
}

const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Heading 1",
    shortcut: "⌘⌥1",
    keywords: ["h1", "heading", "title", "large"],
    icon: `<span style="font-size:11px;font-weight:700;font-family:serif;letter-spacing:-0.5px">H<sub>1</sub></span>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    shortcut: "⌘⌥2",
    keywords: ["h2", "heading", "subtitle"],
    icon: `<span style="font-size:11px;font-weight:700;font-family:serif;letter-spacing:-0.5px">H<sub>2</sub></span>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    shortcut: "⌘⌥3",
    keywords: ["h3", "heading"],
    icon: `<span style="font-size:11px;font-weight:700;font-family:serif;letter-spacing:-0.5px">H<sub>3</sub></span>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "Bulleted list",
    shortcut: "⌘⇧8",
    keywords: ["ul", "bullet", "list", "unordered"],
    icon: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="3" cy="4.5" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="11.5" r="1" fill="currentColor" stroke="none"/><line x1="6" y1="4.5" x2="13" y2="4.5" stroke-linecap="round"/><line x1="6" y1="8" x2="13" y2="8" stroke-linecap="round"/><line x1="6" y1="11.5" x2="13" y2="11.5" stroke-linecap="round"/></svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    shortcut: "⌘⇧9",
    keywords: ["ol", "numbered", "ordered", "list"],
    icon: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><text x="1" y="6" font-size="5.5" fill="currentColor" stroke="none" font-family="sans-serif">1.</text><text x="1" y="10" font-size="5.5" fill="currentColor" stroke="none" font-family="sans-serif">2.</text><text x="1" y="14" font-size="5.5" fill="currentColor" stroke="none" font-family="sans-serif">3.</text><line x1="6" y1="4.5" x2="13" y2="4.5" stroke-linecap="round"/><line x1="6" y1="8" x2="13" y2="8" stroke-linecap="round"/><line x1="6" y1="11.5" x2="13" y2="11.5" stroke-linecap="round"/></svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    shortcut: "⌘⇧7",
    keywords: ["todo", "task", "check", "checklist"],
    icon: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3.5" width="3" height="3" rx="0.5"/><rect x="2" y="7" width="3" height="3" rx="0.5"/><rect x="2" y="10.5" width="3" height="3" rx="0.5"/><path d="M2.5 5 L3.2 5.8 L4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="7" y1="5" x2="13" y2="5" stroke-linecap="round"/><line x1="7" y1="8.5" x2="13" y2="8.5" stroke-linecap="round"/><line x1="7" y1="12" x2="13" y2="12" stroke-linecap="round"/></svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Code block",
    shortcut: "⌘⇧\\",
    keywords: ["code", "pre", "block", "monospace"],
    icon: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M5.5 6.5 L3.5 8 L5.5 9.5"/><path d="M10.5 6.5 L12.5 8 L10.5 9.5"/></svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Blockquote",
    shortcut: "⌥⇧.",
    keywords: ["quote", "blockquote", "cite"],
    icon: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 4.5C3 4.5 2 6 2 7.5C2 8.9 2.9 9.5 3.5 9.5C4.3 9.5 5 8.8 5 8C5 7.2 4.3 6.5 3.5 6.5L4.5 4.5H3ZM9 4.5C9 4.5 8 6 8 7.5C8 8.9 8.9 9.5 9.5 9.5C10.3 9.5 11 8.8 11 8C11 7.2 10.3 6.5 9.5 6.5L10.5 4.5H9Z"/></svg>`,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
]

// ─── Slash command renderer (vanilla DOM + tippy) ─────────────────────────────

function buildSlashRenderer() {
  return () => {
    let el: HTMLDivElement
    let popup: TippyInstance[]
    let currentItems: SlashItem[] = []
    let selectedIndex = 0
    let currentCommand: ((item: SlashItem) => void) | null = null

    function renderItems() {
      el.innerHTML = ""
      currentItems.forEach((item, i) => {
        const row = document.createElement("button")
        row.type = "button"
        row.className = [
          "slash-item",
          i === selectedIndex ? "slash-item--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")

        const iconEl = document.createElement("span")
        iconEl.className = "slash-item__icon"
        iconEl.innerHTML = item.icon

        const labelEl = document.createElement("span")
        labelEl.className = "slash-item__label"
        labelEl.textContent = item.title

        row.appendChild(iconEl)
        row.appendChild(labelEl)

        if (item.shortcut) {
          const kbd = document.createElement("span")
          kbd.className = "slash-item__shortcut"
          kbd.textContent = item.shortcut
          row.appendChild(kbd)
        }

        row.addEventListener("mousedown", (e) => {
          e.preventDefault()
          currentCommand?.(item)
        })

        el.appendChild(row)
      })
    }

    function safeRect(fn: (() => DOMRect | null) | null | undefined): (() => DOMRect) | null {
      if (!fn) return null
      return () => fn() ?? document.body.getBoundingClientRect()
    }

    return {
      onStart(props: SuggestionProps<SlashItem>) {
        selectedIndex = 0
        currentItems = props.items
        currentCommand = props.command

        el = document.createElement("div")
        el.className = "slash-menu"
        renderItems()

        // tippy('body', ...) creates a virtual singleton anchored to the body
        popup = tippy("body", {
          getReferenceClientRect: safeRect(props.clientRect),
          appendTo: () => document.body,
          content: el,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          theme: "slash",
          arrow: false,
          offset: [0, 6],
          maxWidth: 280,
          zIndex: 9999,
        }) as TippyInstance[]
      },

      onUpdate(props: SuggestionProps<SlashItem>) {
        selectedIndex = 0
        currentItems = props.items
        currentCommand = props.command
        renderItems()

        popup[0]?.setProps({
          getReferenceClientRect: safeRect(props.clientRect),
        })
      },

      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (event.key === "ArrowUp") {
          selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length
          renderItems()
          return true
        }
        if (event.key === "ArrowDown") {
          selectedIndex = (selectedIndex + 1) % currentItems.length
          renderItems()
          return true
        }
        if (event.key === "Enter") {
          const item = currentItems[selectedIndex]
          if (item) currentCommand?.(item)
          return true
        }
        if (event.key === "Escape") {
          popup[0]?.hide()
          return true
        }
        return false
      },

      onExit() {
        popup[0]?.destroy()
      },
    }
  }
}

// ─── Slash command Tiptap extension ──────────────────────────────────────────

function createSlashExtension() {
  return Extension.create({
    name: "slashCommand",
    addOptions() {
      return { suggestion: {} }
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          command: ({ editor, range, props }) => {
            ;(props as SlashItem).command({ editor, range })
          },
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase()
            if (!q) return SLASH_ITEMS
            return SLASH_ITEMS.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.keywords.some((k) => k.includes(q)),
            )
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: buildSlashRenderer() as any,
        }),
      ]
    },
  })
}

// ─── Active formats ───────────────────────────────────────────────────────────

interface ActiveFormats {
  bold: boolean
  italic: boolean
  strike: boolean
  underline: boolean
  code: boolean
  blockquote: boolean
}

function getActiveFormats(editor: Editor): ActiveFormats {
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    underline: editor.isActive("underline"),
    code: editor.isActive("code"),
    blockquote: editor.isActive("blockquote"),
  }
}

// ─── Bubble menu ─────────────────────────────────────────────────────────────

interface BubbleMenuState {
  visible: boolean
  x: number
  y: number
  formats: ActiveFormats
}

const EMPTY_BUBBLE: BubbleMenuState = {
  visible: false,
  x: 0,
  y: 0,
  formats: { bold: false, italic: false, strike: false, underline: false, code: false, blockquote: false },
}

function BubbleMenuBar(props: {
  state: BubbleMenuState
  editor: Editor
  onUpdate: () => void
}) {
  function btn(label: string, active: boolean, onClick: () => void, title?: string) {
    return (
      <button
        type="button"
        title={title ?? label}
        class="bubble-btn"
        classList={{ "bubble-btn--active": active }}
        onMouseDown={(e) => {
          e.preventDefault()
          onClick()
          props.onUpdate()
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      class="bubble-menu"
      style={{
        position: "fixed",
        left: `${props.state.x}px`,
        top: `${props.state.y}px`,
        transform: "translateX(-50%) translateY(-100%)",
        "z-index": "9998",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Text style dropdown stub */}
      <button
        type="button"
        title="Text style"
        class="bubble-btn bubble-btn--aa"
        onMouseDown={(e) => e.preventDefault()}
      >
        Aa
        <svg viewBox="0 0 8 5" width="7" height="5" style="margin-left:2px;opacity:0.6">
          <path d="M0.5 0.5 L4 4 L7.5 0.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="bubble-divider" />

      {btn("B", props.state.formats.bold, () => props.editor.chain().focus().toggleBold().run(), "Bold")}
      {btn("I", props.state.formats.italic, () => props.editor.chain().focus().toggleItalic().run(), "Italic")}

      <button
        type="button"
        title="Strikethrough"
        class="bubble-btn"
        classList={{ "bubble-btn--active": props.state.formats.strike }}
        style={{ "text-decoration": "line-through" }}
        onMouseDown={(e) => { e.preventDefault(); props.editor.chain().focus().toggleStrike().run(); props.onUpdate() }}
      >
        S
      </button>

      <button
        type="button"
        title="Underline"
        class="bubble-btn"
        classList={{ "bubble-btn--active": props.state.formats.underline }}
        style={{ "text-decoration": "underline" }}
        onMouseDown={(e) => { e.preventDefault(); props.editor.chain().focus().toggleUnderline().run(); props.onUpdate() }}
      >
        U
      </button>

      {/* Link */}
      <button type="button" title="Link" class="bubble-btn" onMouseDown={(e) => e.preventDefault()}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7.5 3.5"/>
          <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/>
        </svg>
      </button>

      {/* Blockquote */}
      <button
        type="button"
        title="Blockquote"
        class="bubble-btn"
        classList={{ "bubble-btn--active": props.state.formats.blockquote }}
        onMouseDown={(e) => { e.preventDefault(); props.editor.chain().focus().toggleBlockquote().run(); props.onUpdate() }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
          <path d="M3 4.5C3 4.5 2 6 2 7.5C2 8.9 2.9 9.5 3.5 9.5C4.3 9.5 5 8.8 5 8C5 7.2 4.3 6.5 3.5 6.5L4.5 4.5H3ZM9 4.5C9 4.5 8 6 8 7.5C8 8.9 8.9 9.5 9.5 9.5C10.3 9.5 11 8.8 11 8C11 7.2 10.3 6.5 9.5 6.5L10.5 4.5H9Z"/>
        </svg>
      </button>

      <div class="bubble-divider" />

      {/* Clear formatting */}
      <button
        type="button"
        title="Clear formatting"
        class="bubble-btn"
        onMouseDown={(e) => { e.preventDefault(); props.editor.chain().focus().unsetAllMarks().run(); props.onUpdate() }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M3 3 L13 13 M13 3 L3 13"/>
        </svg>
      </button>

      {/* Inline code */}
      {btn(
        "</>",
        props.state.formats.code,
        () => props.editor.chain().focus().toggleCode().run(),
        "Inline code",
      )}

      {/* Code block */}
      <button
        type="button"
        title="Code block"
        class="bubble-btn"
        onMouseDown={(e) => { e.preventDefault(); props.editor.chain().focus().toggleCodeBlock().run(); props.onUpdate() }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1.5" y="3" width="13" height="10" rx="1.5"/>
          <path d="M5.5 6.5 L3.5 8 L5.5 9.5"/>
          <path d="M10.5 6.5 L12.5 8 L10.5 9.5"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Markdown paste handler ───────────────────────────────────────────────────

function applyInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
}

function markdownToHtml(text: string): string {
  const lines = text.split("\n")
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith("```")) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      out.push(`<pre><code>${codeLines.join("\n")}</code></pre>`)
      continue
    }

    // Headings
    const h3 = line.match(/^### (.+)/)
    if (h3) { out.push(`<h3>${applyInlineMarkdown(h3[1])}</h3>`); i++; continue }
    const h2 = line.match(/^## (.+)/)
    if (h2) { out.push(`<h2>${applyInlineMarkdown(h2[1])}</h2>`); i++; continue }
    const h1 = line.match(/^# (.+)/)
    if (h1) { out.push(`<h1>${applyInlineMarkdown(h1[1])}</h1>`); i++; continue }

    // Blockquote
    if (line.startsWith("> ")) {
      out.push(`<blockquote><p>${applyInlineMarkdown(line.slice(2))}</p></blockquote>`)
      i++
      continue
    }

    // Bullet list
    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${applyInlineMarkdown(lines[i].slice(2))}</li>`)
        i++
      }
      out.push(`<ul>${items.join("")}</ul>`)
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${applyInlineMarkdown(lines[i].replace(/^\d+\. /, ""))}</li>`)
        i++
      }
      out.push(`<ol>${items.join("")}</ol>`)
      continue
    }

    // Blank line → paragraph break (skip)
    if (!line.trim()) {
      i++
      continue
    }

    // Regular paragraph
    out.push(`<p>${applyInlineMarkdown(line)}</p>`)
    i++
  }

  return out.join("")
}

function looksLikeMarkdown(text: string): boolean {
  return /^(#{1,3} |[-*] |\d+\. |> |```)/m.test(text)
}

// ─── Main TiptapEditor component ──────────────────────────────────────────────

interface TiptapEditorProps {
  content?: string
  placeholder?: string
  onChange?: (html: string) => void
  class?: string
  editorClass?: string
  /** "default" = bare editor (descriptions), "comment" = boxed with bg (comments) */
  variant?: "default" | "comment"
}

export default function TiptapEditor(props: TiptapEditorProps) {
  let containerRef: HTMLDivElement | undefined
  let editorInstance: Editor | undefined

  const [bubble, setBubble] = createSignal<BubbleMenuState>(EMPTY_BUBBLE)

  function updateBubble(editor: Editor) {
    const { state, view } = editor
    const { selection } = state
    const { empty, from, to } = selection

    if (empty || from === to) {
      setBubble(EMPTY_BUBBLE)
      return
    }

    const startCoords = view.coordsAtPos(from)
    const endCoords = view.coordsAtPos(to)
    const x = (startCoords.left + endCoords.right) / 2
    const y = startCoords.top

    setBubble({
      visible: true,
      x,
      y: y - 38, // gap above the selected text
      formats: getActiveFormats(editor),
    })
  }

  onMount(() => {
    if (!containerRef) return

    editorInstance = new Editor({
      element: containerRef,
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: props.placeholder ?? "Add description…",
          emptyEditorClass: "is-editor-empty",
        }),
        Underline,
        Link.configure({ openOnClick: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        createSlashExtension(),
      ],
      content: props.content ?? "",
      editorProps: {
        attributes: {
          class: ["tiptap-prose", props.editorClass ?? ""].filter(Boolean).join(" "),
        },
        handlePaste(_view, event) {
          const plain = event.clipboardData?.getData("text/plain") ?? ""
          if (!plain || !looksLikeMarkdown(plain)) return false
          event.preventDefault()
          editorInstance?.commands.insertContent(markdownToHtml(plain))
          return true
        },
      },
      onUpdate: ({ editor }) => {
        props.onChange?.(editor.getHTML())
      },
      onSelectionUpdate: ({ editor }) => {
        updateBubble(editor)
      },
      onTransaction: ({ editor }) => {
        // Keep active states fresh if bubble is visible
        if (bubble().visible) {
          setBubble((prev) => ({
            ...prev,
            formats: getActiveFormats(editor),
          }))
        }
      },
      onBlur: () => {
        // Small delay so bubble menu button clicks fire before hiding
        setTimeout(() => {
          if (!editorInstance?.isFocused) {
            setBubble(EMPTY_BUBBLE)
          }
        }, 150)
      },
    })
  })

  onCleanup(() => {
    editorInstance?.destroy()
  })

  const isComment = () => props.variant === "comment"

  return (
    <div
      class={[
        props.class,
        isComment()
          ? "bg-secondary/20 border border-border/40 rounded-md px-3 py-2 focus-within:border-border focus-within:ring-1 focus-within:ring-ring/30 transition-colors"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={containerRef} />

      <Portal>
        <Show when={bubble().visible}>
          <BubbleMenuBar
            state={bubble()}
            editor={editorInstance!}
            onUpdate={() => {
              if (editorInstance) updateBubble(editorInstance)
            }}
          />
        </Show>
      </Portal>
    </div>
  )
}
