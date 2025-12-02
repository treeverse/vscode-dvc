/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectHeaders"] }] */
import '@testing-library/jest-dom'
import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, queries, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { TableData } from 'dvc/src/experiments/webview/contract'
import { MessageFromWebviewType } from 'dvc/src/webview/contract'
import React from 'react'
import tableDataFixture from 'dvc/src/test/fixtures/expShow/base/tableData'
import { EXPERIMENT_WORKSPACE_ID } from 'dvc/src/cli/dvc/contract'
import styles from './styles.module.scss'
import { SortOrder } from './header/util'
import { ExperimentsTable } from '../ExperimentsTable'
import { vsCodeApi } from '../../../shared/api'
import {
  expectHeaders,
  getHeaders,
  tableData as sortingTableDataFixture
} from '../../../test/sort'
import { dragAndDrop, dragEnter, dragLeave } from '../../../test/dragDrop'
import { DragEnterDirection } from '../../../shared/components/dragDrop/util'
import { experimentsReducers } from '../../store'
import { customQueries } from '../../../test/queries'
import { collectColumnData } from '../../state/tableDataSlice'

jest.mock('../../../shared/api')

const { postMessage } = vsCodeApi
const mockedPostMessage = jest.mocked(postMessage)

describe('Table', () => {
  const renderExperimentsTable = (
    partialTableData: Partial<TableData> = {}
  ) => {
    const tableData = {
      ...sortingTableDataFixture,
      ...partialTableData,
      branches: ['main']
    }
    tableData.columnData = collectColumnData(tableData.columns)
    return render(
      <Provider
        store={configureStore({
          preloadedState: { tableData },
          reducer: experimentsReducers
        })}
      >
        <ExperimentsTable />
      </Provider>,
      {
        queries: { ...queries, ...customQueries }
      }
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Sorting through the UI', () => {
    const mockColumnName = 'C'
    const mockColumnPath = 'params:C'

    const clickOnSortOption = async (optionLabel: SortOrder) => {
      const column = await screen.findByText(mockColumnName)
      fireEvent.contextMenu(column, {
        bubbles: true
      })

      const sortOption = await screen.findByText(optionLabel)
      fireEvent.click(sortOption)
    }

    describe('Sortable column', () => {
      it('should not not have a sorting indicator if it is not sorted yet', () => {
        renderExperimentsTable()
        const sortIcons = screen.queryAllByTestId('sorting-indicator')

        expect(sortIcons.length).toBe(0)
      })

      it('should be able to add an ascending sort to the column, if it is not sorted yet', async () => {
        renderExperimentsTable()
        await clickOnSortOption(SortOrder.ASCENDING)

        expect(mockedPostMessage).toHaveBeenCalledWith({
          payload: {
            descending: false,
            path: mockColumnPath
          },
          type: MessageFromWebviewType.SORT_COLUMN
        })
      })

      it('should add a descending sort to the column, when clicking on the descending option', async () => {
        renderExperimentsTable({
          ...sortingTableDataFixture,
          sorts: [
            {
              descending: false,
              path: mockColumnPath
            }
          ]
        })

        await clickOnSortOption(SortOrder.DESCENDING)

        expect(mockedPostMessage).toHaveBeenCalledWith({
          payload: {
            descending: true,
            path: mockColumnPath
          },
          type: MessageFromWebviewType.SORT_COLUMN
        })
      })

      it('should remove the column sort if the remove option is selected', async () => {
        renderExperimentsTable({
          ...sortingTableDataFixture,
          sorts: [
            {
              descending: true,
              path: mockColumnPath
            }
          ]
        })

        await clickOnSortOption(SortOrder.NONE)

        expect(mockedPostMessage).toHaveBeenCalledWith({
          payload: mockColumnPath,
          type: MessageFromWebviewType.REMOVE_COLUMN_SORT
        })
      })
    })
  })

  describe('Head Depth', () => {
    it('should be updated by the user in the header context menu', async () => {
      renderExperimentsTable()
      const column = await screen.findByText('C')
      fireEvent.contextMenu(column, {
        bubbles: true
      })

      const sortOption = await screen.findByText('Set Max Header Height')
      fireEvent.click(sortOption)

      expect(mockedPostMessage).toHaveBeenCalledWith({
        type: MessageFromWebviewType.SET_EXPERIMENTS_HEADER_HEIGHT
      })
    })
  })

  describe('Changes', () => {
    it("should not have the workspaceChange class on the workspace's first cell (text) workspace changes", async () => {
      renderExperimentsTable()

      const workspaceCell = await screen.findByText(EXPERIMENT_WORKSPACE_ID)

      expect(
        workspaceCell?.className.includes(styles.workspaceChangeText)
      ).toBe(false)
    })

    it("should have the workspaceChange class on the workspace's first cell (text) if there are workspace changes", () => {
      renderExperimentsTable({ changes: ['something_changed'] })

      const workspaceCell = screen.getByTestId('id___workspace')

      expect(workspaceCell.className.includes(styles.workspaceChangeText)).toBe(
        true
      )
    })

    it('should not have the workspaceChange class on a cell if there are no changes', async () => {
      renderExperimentsTable()

      const row = await screen.findByTestId('Created___workspace')

      expect(row?.className.includes(styles.workspaceChangeText)).toBe(false)
    })

    it('should not have the workspaceChange class on a cell if there are changes to other columns but not this one', async () => {
      renderExperimentsTable({ changes: ['a_change'] })

      const row = await screen.findByTestId('Created___workspace')

      expect(row?.className.includes(styles.workspaceChangeText)).toBe(false)
    })

    it('should have the workspaceChange class on a cell if there are changes matching the column id', async () => {
      renderExperimentsTable({ changes: ['Created'] })

      const row = await screen.findByTestId('Created___workspace')

      expect(row?.className.includes(styles.workspaceChangeText)).toBe(true)
    })
  })

  describe('Columns order', () => {
    it('should move a column from its current position to its new position', async () => {
      const { getDraggableHeaderFromText } = renderExperimentsTable()

      await expectHeaders(['A', 'B', 'C'])

      dragAndDrop(
        screen.getByText('B'),
        getDraggableHeaderFromText('C'),
        DragEnterDirection.AUTO
      )

      await expectHeaders(['A', 'C', 'B'])

      dragAndDrop(
        screen.getByText('A'),
        getDraggableHeaderFromText('B'),
        DragEnterDirection.AUTO
      )

      await expectHeaders(['C', 'B', 'A'])
    })

    it('should not move a column before the default columns', async () => {
      renderExperimentsTable()

      dragAndDrop(
        screen.getByText('B'),
        screen.getByText('Experiment'),
        DragEnterDirection.AUTO
      )

      await expectHeaders(['A', 'B', 'C'])
    })

    it('should order the columns with the columnOrder from the data', async () => {
      const columnOrder = ['id', 'Created', 'params:C', 'params:B', 'params:A']
      const tableDataWithCustomColOrder = {
        ...sortingTableDataFixture,
        columnOrder
      }
      renderExperimentsTable(tableDataWithCustomColOrder)

      await expectHeaders(['C', 'B', 'A'])
    })

    it('should resize columns and persist new state when a separator is clicked and dragged', async () => {
      jest.useFakeTimers()
      const columnWidths = {
        id: 333
      }

      const tableDataWithColumnSetting = {
        ...sortingTableDataFixture,
        columnWidths
      }
      render(
        <Provider
          store={configureStore({
            preloadedState: { tableData: tableDataWithColumnSetting },
            reducer: experimentsReducers
          })}
        >
          <ExperimentsTable />
        </Provider>
      )
      const [experimentColumnResizeHandle] =
        await screen.findAllByRole('separator')

      fireEvent.mouseDown(experimentColumnResizeHandle, {
        bubbles: true
      })
      fireEvent.mouseMove(experimentColumnResizeHandle, {
        clientX: 100
      })
      fireEvent.mouseUp(experimentColumnResizeHandle)
      jest.runAllTimers()

      expect(mockedPostMessage).toHaveBeenCalledWith({
        payload: { id: 'id', width: columnWidths.id + 100 },
        type: MessageFromWebviewType.RESIZE_COLUMN
      })
      jest.useRealTimers()
    })

    it('should not resize the column and persist new state if the width did not change', async () => {
      jest.useFakeTimers()
      const columnWidths = {
        id: 333
      }

      const tableDataWithColumnSetting = {
        ...sortingTableDataFixture,
        columnWidths
      }
      render(
        <Provider
          store={configureStore({
            preloadedState: { tableData: tableDataWithColumnSetting },
            reducer: experimentsReducers
          })}
        >
          <ExperimentsTable />
        </Provider>
      )
      const [experimentColumnResizeHandle] =
        await screen.findAllByRole('separator')

      fireEvent.mouseDown(experimentColumnResizeHandle, {
        bubbles: true
      })
      fireEvent.mouseMove(experimentColumnResizeHandle, {
        clientX: 0
      })
      fireEvent.mouseUp(experimentColumnResizeHandle)
      jest.runAllTimers()

      expect(mockedPostMessage).not.toHaveBeenCalled()
      jest.useRealTimers()
    })

    it('should move all the columns from a group from their current position to their new position', async () => {
      const { getDraggableHeaderFromText } = renderExperimentsTable({
        ...tableDataFixture
      })

      let headers = await getHeaders()

      expect(headers.indexOf('threshold')).toBeGreaterThan(
        headers.indexOf('accuracy')
      )
      expect(headers.indexOf('test')).toBeGreaterThan(
        headers.indexOf('accuracy')
      )

      dragAndDrop(
        screen.getByText('process'),
        getDraggableHeaderFromText('loss'),
        DragEnterDirection.AUTO
      )

      headers = await getHeaders()

      expect(headers.indexOf('accuracy')).toBeGreaterThan(
        headers.indexOf('threshold')
      )

      const [startingNode] = screen.getAllByText('summary.json')
      dragAndDrop(
        startingNode,
        getDraggableHeaderFromText('test'),
        DragEnterDirection.AUTO
      )

      headers = await getHeaders()

      expect(headers.indexOf('accuracy')).toBeGreaterThan(
        headers.indexOf('test')
      )
    })

    it('should remove the drop zone when hovering out a target column header', async () => {
      const { getDraggableHeaderFromText } = renderExperimentsTable({
        ...tableDataFixture
      })

      await getHeaders()

      const startingNode = screen.getByText('process')
      const targetNode = getDraggableHeaderFromText('loss')
      const header = screen.getByTestId('header-metrics:summary.json:loss')

      dragEnter(startingNode, targetNode.id, DragEnterDirection.AUTO)

      expect(
        header?.classList.contains(styles.dropTargetHeaderCell)
      ).toBeTruthy()

      dragLeave(targetNode)

      expect(
        header?.classList.contains(styles.dropTargetHeaderCell)
      ).toBeFalsy()
    })

    it('split group should be moving properly', async () => {
      // test for https://github.com/treeverse/vscode-dvc/issues/3679
      const { getDraggableHeaderFromText } = renderExperimentsTable({
        ...tableDataFixture
      })

      let headers = await getHeaders()

      // splits metrics and params group into 4 subgroups
      dragAndDrop(
        screen.getByText('val_accuracy'),
        getDraggableHeaderFromText('learning_rate'),
        DragEnterDirection.AUTO
      )

      headers = await getHeaders()

      expect(headers.indexOf('val_accuracy')).toBeGreaterThan(
        headers.indexOf('learning_rate')
      )

      // note: moving the group here, not the leaf column
      let metricGroups = screen.getAllByText('summary.json')
      expect(metricGroups.length).toBe(2)

      dragAndDrop(
        metricGroups[1],
        getDraggableHeaderFromText('learning_rate'),
        DragEnterDirection.AUTO
      )

      headers = await getHeaders()

      metricGroups = screen.getAllByText('summary.json')
      const paramsGroups = screen.getAllByText('params.yaml')

      expect(metricGroups.length).toBe(2)
      expect(paramsGroups.length).toBe(2)

      expect(headers.indexOf('val_accuracy')).toBeLessThan(
        headers.indexOf('learning_rate')
      )
      expect(headers.indexOf('epochs')).toBeGreaterThan(
        headers.indexOf('val_loss')
      )
    })
  })
})
