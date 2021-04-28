import { DragOutlined } from '@ant-design/icons'
import Card, { CardProps } from 'antd/lib/card'
import arrayMove from 'array-move'
import React, {
  memo,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useState
} from 'react'
import {
  SortableContainer as sortableContainer,
  SortableElement as sortableElement,
  SortableHandle as sortableHandle,
  SortEnd
} from 'react-sortable-hoc'
import './CardList.less'

interface CardListProps<T> {
  items: T[]
  renderItem: (value: T) => CardProps
  sortable?: boolean
  handlePositionChange?: (item: T, newPosition: number) => Promise<unknown>
}

const DragHandle = sortableHandle(() => (
  <DragOutlined className="drag-handle" />
))

const SortableElement = sortableElement(({ value }: { value: ReactNode }) => (
  <>{value}</>
))

const SortableContainer = sortableContainer(
  ({ children }: PropsWithChildren<unknown>) => {
    return <ul className="card-list">{children}</ul>
  }
)

function CardList<T>(props: React.PropsWithChildren<CardListProps<T>>) {
  const { renderItem, handlePositionChange } = props
  const [items, setItems] = useState(props.items)
  useEffect(() => setItems(props.items), [props.items])
  const sortable = props.sortable && items.length > 1
  const renderCard = (item: T, index: number) => {
    const { children: cardChildren, title, ...cardProps } = renderItem(item)
    return (
      <li className="card-list-item" key={index}>
        <Card
          title={
            sortable ? (
              <>
                <DragHandle /> {title}
              </>
            ) : (
              title
            )
          }
          {...cardProps}
        >
          {cardChildren}
        </Card>
      </li>
    )
  }
  const onSortEnd = ({ oldIndex, newIndex }: SortEnd) => {
    document.body.classList.remove('dragging')
    if (oldIndex === newIndex) {
      return
    }
    const item = items[oldIndex]
    setItems(arrayMove(items, oldIndex, newIndex))
    if (handlePositionChange) {
      handlePositionChange(item, newIndex).catch(() => setItems(props.items))
    }
  }
  if (!sortable) {
    return <ul className="card-list">{items.map(renderCard)}</ul>
  }

  const onSortStart = () => document.body.classList.add('dragging')
  return (
    <SortableContainer
      useDragHandle
      lockAxis="y"
      onSortEnd={onSortEnd}
      onSortStart={onSortStart}
    >
      {items.map((item, index) => (
        <SortableElement
          key={index}
          index={index}
          value={renderCard(item, index)}
        />
      ))}
    </SortableContainer>
  )
}

export default memo(CardList) as typeof CardList
