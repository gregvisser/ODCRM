/**
 * DataTable - Professional, feature-rich data table component
 * 
 * Features:
 * - Column sorting (click to sort asc/desc)
 * - Column filtering (per-column search)
 * - Column resizing (drag dividers)
 * - Column reordering (drag headers)
 * - Column visibility toggle
 * - Pagination
 * - Export (CSV)
 * - User preferences (saved to localStorage)
 * - Responsive (mobile cards, desktop table)
 * - Compact professional styling
 * 
 * Built with:
 * - TanStack Table v8
 * - @dnd-kit for drag and drop
 * - Chakra UI for styling
 */

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Button,
  Input,
  HStack,
  VStack,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
  useBreakpointValue,
  Spinner,
  Badge,
} from '@chakra-ui/react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SettingsIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@chakra-ui/icons'
import { useState, useEffect, useMemo } from 'react'
import { getJson, setJson } from '../platform/storage'

// Types
export interface DataTableColumn<T> {
  id: string
  header: string
  accessorKey?: keyof T
  accessorFn?: (row: T) => any
  cell?: (props: { row: T; value: any }) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
  width?: number
  minWidth?: number
  maxWidth?: number
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  tableId: string  // Unique ID for saving preferences
  enableSorting?: boolean
  enableFiltering?: boolean
  enableColumnReorder?: boolean
  enableColumnResize?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  enableExport?: boolean
  compact?: boolean
  loading?: boolean
  pageSize?: number
  emptyMessage?: string
}

// Helper: Save preferences to localStorage
function saveTablePreferences(
  tableId: string,
  preferences: {
    sorting?: SortingState
    columnOrder?: string[]
    columnSizing?: ColumnSizingState
    columnVisibility?: VisibilityState
    columnFilters?: ColumnFiltersState
  }
) {
  const key = `table_${tableId}_preferences`
  const existing = getJson<any>(key) || {}
  setJson(key, { ...existing, ...preferences })
}

// Helper: Load preferences from localStorage
function loadTablePreferences(tableId: string) {
  const key = `table_${tableId}_preferences`
  return getJson<any>(key) || {}
}

// Helper: Export to CSV
function exportToCSV<T>(data: T[], columns: DataTableColumn<T>[], filename: string) {
  // Use original column order, not UI order
  const headers = columns.map(col => col.header).join(',')
  const rows = data.map(row => {
    return columns
      .map(col => {
        const value = col.accessorKey
          ? row[col.accessorKey]
          : col.accessorFn
          ? col.accessorFn(row)
          : ''
        // Escape commas and quotes
        const stringValue = String(value || '').replace(/"/g, '""')
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue
      })
      .join(',')
  }).join('\n')
  
  const csv = `${headers}\n${rows}`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Sortable Header Cell Component
function SortableHeader({
  id,
  header,
  isSorted,
  sortDirection,
  onSort,
  enableReorder,
}: {
  id: string
  header: string
  isSorted: boolean
  sortDirection?: 'asc' | 'desc'
  onSort: () => void
  enableReorder: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enableReorder })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: enableReorder ? 'grab' : 'default',
  }

  return (
    <Th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      fontSize="xs"
      py={2}
      px={3}
      onClick={onSort}
      cursor="pointer"
      _hover={{ bg: 'gray.200' }}
      userSelect="none"
    >
      <HStack spacing={1} justify="space-between">
        <Text>{header}</Text>
        {isSorted && (
          sortDirection === 'asc' ? (
            <ChevronUpIcon boxSize={3} />
          ) : (
            <ChevronDownIcon boxSize={3} />
          )
        )}
      </HStack>
    </Th>
  )
}

// Main DataTable Component
export function DataTable<T extends Record<string, any>>({
  data,
  columns: columnsProp,
  tableId,
  enableSorting = true,
  enableFiltering = true,
  enableColumnReorder = true,
  enableColumnResize = true,
  enableColumnVisibility = true,
  enablePagination = true,
  enableExport = true,
  compact = true,
  loading = false,
  pageSize = 50,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  // Load saved preferences
  const savedPrefs = loadTablePreferences(tableId)
  
  // State
  const [sorting, setSorting] = useState<SortingState>(savedPrefs.sorting || [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(savedPrefs.columnFilters || [])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(savedPrefs.columnVisibility || {})
  const [columnOrder, setColumnOrder] = useState<string[]>(
    savedPrefs.columnOrder || columnsProp.map(col => col.id)
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(savedPrefs.columnSizing || {})
  
  // Responsive: Show mobile cards or desktop table
  const isMobile = useBreakpointValue({ base: true, md: false })
  
  // Build TanStack Table columns
  const columns = useMemo<ColumnDef<T>[]>(() => {
    return columnsProp.map(col => ({
      id: col.id,
      accessorKey: col.accessorKey as string,
      accessorFn: col.accessorFn,
      header: col.header,
      cell: col.cell
        ? (info) => col.cell!({ row: info.row.original, value: info.getValue() })
        : (info) => {
            const value = info.getValue()
            if (value === null || value === undefined) return ''
            return value as React.ReactNode
          },
      enableSorting: enableSorting && col.sortable !== false,
      enableColumnFilter: enableFiltering && col.filterable !== false,
      size: col.width || columnSizing[col.id] || 150,
      minSize: col.minWidth || 100,
      maxSize: col.maxWidth || 500,
    }))
  }, [columnsProp, enableSorting, enableFiltering, columnSizing])
  
  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize,
      },
    },
    enableColumnResizing: enableColumnResize,
    columnResizeMode: 'onChange',
  })
  
  // Save preferences when they change
  useEffect(() => {
    saveTablePreferences(tableId, {
      sorting,
      columnOrder,
      columnSizing,
      columnVisibility,
      columnFilters,
    })
  }, [tableId, sorting, columnOrder, columnSizing, columnVisibility, columnFilters])
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )
  
  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setColumnOrder((prevOrder) => {
        const oldIndex = prevOrder.indexOf(active.id as string)
        const newIndex = prevOrder.indexOf(over.id as string)
        return arrayMove(prevOrder, oldIndex, newIndex)
      })
    }
  }
  
  // Export function
  const handleExport = () => {
    const filename = `${tableId}_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(data, columnsProp, filename)
  }
  
  // Reset preferences
  const handleReset = () => {
    setSorting([])
    setColumnFilters([])
    setColumnVisibility({})
    setColumnOrder(columnsProp.map(col => col.id))
    setColumnSizing({})
    saveTablePreferences(tableId, {})
  }
  
  if (loading) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="lg" color="brand.500" />
        <Text mt={3} color="gray.600">Loading...</Text>
      </Box>
    )
  }
  
  if (data.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Text color="gray.500">{emptyMessage}</Text>
      </Box>
    )
  }
  
  // Mobile view: Cards
  if (isMobile) {
    return (
      <VStack spacing={3} align="stretch">
        {table.getRowModel().rows.map(row => (
          <Box
            key={row.id}
            p={3}
            bg="white"
            borderRadius="md"
            border="1px"
            borderColor="gray.200"
            shadow="sm"
          >
            {row.getVisibleCells().map(cell => (
              <HStack key={cell.id} justify="space-between" py={1}>
                <Text fontSize="xs" color="gray.600" fontWeight="medium">
                  {cell.column.columnDef.header as string}
                </Text>
                <Text fontSize="sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Text>
              </HStack>
            ))}
          </Box>
        ))}
        
        {enablePagination && (
          <HStack justify="space-between" pt={3}>
            <Button
              size="sm"
              onClick={() => table.previousPage()}
              isDisabled={!table.getCanPreviousPage()}
              leftIcon={<ChevronLeftIcon />}
            >
              Previous
            </Button>
            <Text fontSize="sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </Text>
            <Button
              size="sm"
              onClick={() => table.nextPage()}
              isDisabled={!table.getCanNextPage()}
              rightIcon={<ChevronRightIcon />}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>
    )
  }
  
  // Desktop view: Table
  return (
    <VStack spacing={3} align="stretch">
      {/* Toolbar */}
      <HStack justify="space-between">
        <HStack spacing={2}>
          {enableColumnVisibility && (
            <Menu>
              <MenuButton as={IconButton} icon={<SettingsIcon />} size="sm" variant="outline">
                Columns
              </MenuButton>
              <MenuList maxH="400px" overflowY="auto">
                {table.getAllLeafColumns().map(column => (
                  <MenuItem key={column.id} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      isChecked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    >
                      {column.columnDef.header as string}
                    </Checkbox>
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          )}
          
          <Button size="sm" variant="ghost" onClick={handleReset}>
            Reset
          </Button>
        </HStack>
        
        <HStack spacing={2}>
          <Badge colorScheme="blue" fontSize="xs">
            {data.length} total
          </Badge>
          
          {enableExport && (
            <IconButton
              icon={<DownloadIcon />}
              size="sm"
              variant="outline"
              onClick={handleExport}
              aria-label="Export CSV"
            />
          )}
        </HStack>
      </HStack>
      
      {/* Table */}
      <Box
        overflowX="auto"
        border="1px"
        borderColor="gray.200"
        borderRadius="md"
        bg="white"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnOrder}
            strategy={horizontalListSortingStrategy}
          >
            <Table size={compact ? 'sm' : 'md'} variant="simple">
              <Thead bg="gray.100">
                <Tr>
                  {table.getHeaderGroups()[0].headers.map(header => (
                    <SortableHeader
                      key={header.id}
                      id={header.id}
                      header={flexRender(header.column.columnDef.header, header.getContext()) as string}
                      isSorted={header.column.getIsSorted() !== false}
                      sortDirection={header.column.getIsSorted() as 'asc' | 'desc' | undefined}
                      onSort={header.column.getToggleSortingHandler() || (() => {})}
                      enableReorder={enableColumnReorder}
                    />
                  ))}
                </Tr>
                
                {/* Filter row */}
                {enableFiltering && (
                  <Tr>
                    {table.getHeaderGroups()[0].headers.map(header => (
                      <Th key={header.id} py={1} px={2}>
                        {header.column.getCanFilter() && (
                          <Input
                            size="xs"
                            placeholder={`Filter...`}
                            value={(header.column.getFilterValue() as string) || ''}
                            onChange={(e) => header.column.setFilterValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </Th>
                    ))}
                  </Tr>
                )}
              </Thead>
              
              <Tbody>
                {table.getRowModel().rows.map(row => (
                  <Tr key={row.id} _hover={{ bg: 'gray.50' }}>
                    {row.getVisibleCells().map(cell => (
                      <Td key={cell.id} fontSize="sm" py={2} px={3}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </SortableContext>
        </DndContext>
      </Box>
      
      {/* Pagination */}
      {enablePagination && (
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Button
              size="sm"
              onClick={() => table.setPageIndex(0)}
              isDisabled={!table.getCanPreviousPage()}
            >
              First
            </Button>
            <Button
              size="sm"
              onClick={() => table.previousPage()}
              isDisabled={!table.getCanPreviousPage()}
              leftIcon={<ChevronLeftIcon />}
            >
              Previous
            </Button>
          </HStack>
          
          <Text fontSize="sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} 
            {' '}({table.getFilteredRowModel().rows.length} rows)
          </Text>
          
          <HStack spacing={2}>
            <Button
              size="sm"
              onClick={() => table.nextPage()}
              isDisabled={!table.getCanNextPage()}
              rightIcon={<ChevronRightIcon />}
            >
              Next
            </Button>
            <Button
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              isDisabled={!table.getCanNextPage()}
            >
              Last
            </Button>
          </HStack>
        </HStack>
      )}
    </VStack>
  )
}
