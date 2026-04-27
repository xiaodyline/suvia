
export interface ImageContentItem {
  type: 'image'
  mimeType: string
  data: string
}

export interface AIMessageJson {
  kwargs: {
    content: Array<any>
  }
}

export function getImageFromLastMessage(lastMessage: AIMessageJson): ImageContentItem | null {
  const content = lastMessage?.kwargs?.content ?? []

  const imageItem = content.find((item): item is ImageContentItem => {
    return (
      item.type === 'image' &&
      typeof item.mimeType === 'string' &&
      typeof item.data === 'string'
    )
  })

  return imageItem || null
}