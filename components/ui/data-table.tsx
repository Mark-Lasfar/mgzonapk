// components/ui/data-table.tsx

import { useState } from 'react';

interface Column {
  header: string;
  accessorKey: string;
  cell?: (row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  searchKey: string;
}

export const DataTable = ({ columns, data, searchKey }: DataTableProps) => {
  const [search, setSearch] = useState('');

  // تصفية البيانات بناءً على النص المدخل في خانة البحث
  const filteredData = data.filter((row) =>
    row[searchKey].toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* خانة البحث */}
      <div className="flex items-center mb-4">
        <input
          type="text"
          className="p-2 border rounded"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* جدول البيانات */}
      <table className="min-w-full table-auto">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.accessorKey} className="px-4 py-2 text-left">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.length > 0 ? (
            filteredData.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.accessorKey} className="px-4 py-2">
                    {column.cell ? column.cell({ row }) : row[column.accessorKey]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2 text-center">
                No results found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
