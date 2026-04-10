const TITLE_TEMPLATE = "%s | Linya"

export default function getTitle(title: string = "Home") {
  return TITLE_TEMPLATE.replace("%s", title)
}
