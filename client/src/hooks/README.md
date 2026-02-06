# Custom React Hooks

This directory contains reusable React hooks that eliminate common boilerplate patterns throughout the application.

## 📚 Available Hooks

### 1. `useAsyncData` - Async Data Fetching

Manages async data fetching with automatic loading and error states.

**Use Case:** Loading data from API on component mount or when dependencies change.

```tsx
import { useAsyncData } from '@/hooks';

function TournamentsList() {
  const { data, loading, error, refetch } = useAsyncData({
    fetchFn: () => adminService.getAllTournaments(),
    errorMessage: 'Failed to load tournaments',
    dependencies: [], // Re-fetch when dependencies change
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {data.tournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

**Eliminates:**
- `const [data, setData] = useState(null)`
- `const [loading, setLoading] = useState(true)`
- `const [error, setError] = useState(null)`
- `useEffect(() => { ... }, [])`
- Try/catch blocks
- Toast error notifications

---

### 2. `useAsyncSubmit` - Form Submission

Manages form submission with loading state and success/error handling.

**Use Case:** Submitting forms to API with loading states.

```tsx
import { useAsyncSubmit } from '@/hooks';

function CreateTournamentForm() {
  const { loading, submit } = useAsyncSubmit({
    submitFn: (data) => adminService.createTournament(data),
    successMessage: 'Tournament created successfully!',
    onSuccess: () => navigate('/admin/tournaments'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

**Eliminates:**
- Manual loading state management
- Try/catch blocks
- Toast success/error notifications
- Navigation after success

---

### 3. `useModal` - Modal State Management

Manages modal open/close state and associated data (e.g., item being edited).

**Use Case:** Managing modals for create/edit/delete operations.

```tsx
import { useModal } from '@/hooks';

function TournamentsList() {
  const editModal = useModal<Tournament>();
  const deleteModal = useModal<string>(); // For tournament ID

  return (
    <div>
      {tournaments.map(t => (
        <div key={t.id}>
          <button onClick={() => editModal.open(t)}>Edit</button>
          <button onClick={() => deleteModal.open(t.id)}>Delete</button>
        </div>
      ))}

      <EditModal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        tournament={editModal.data}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        tournamentId={deleteModal.data}
      />
    </div>
  );
}
```

**Multiple modals:**
```tsx
import { useModals } from '@/hooks';

const modals = useModals(['create', 'edit', 'delete'] as const);

modals.create.open();
modals.edit.open(tournament);
modals.delete.close();
```

**Eliminates:**
- `const [modalOpen, setModalOpen] = useState(false)`
- `const [selectedItem, setSelectedItem] = useState(null)`
- Modal open/close handlers

---

### 4. `useForm` - Form State Management

Comprehensive form state management with validation, error handling, and submission.

**Use Case:** Building forms with validation.

```tsx
import { useForm } from '@/hooks';

interface FormValues {
  name: string;
  email: string;
  age: number;
}

function UserForm() {
  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      email: '',
      age: 0,
    },
    validate: (values) => {
      const errors: any = {};
      if (!values.name) errors.name = 'Name is required';
      if (!values.email) errors.email = 'Email is required';
      if (values.age < 18) errors.age = 'Must be 18 or older';
      return errors;
    },
    onSubmit: async (values) => {
      await userService.create(values);
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <div>
        <input
          type="text"
          value={form.values.name}
          onChange={form.handleChange('name')}
          onBlur={form.handleBlur('name')}
        />
        {form.touched.name && form.errors.name && (
          <span className="error">{form.errors.name}</span>
        )}
      </div>

      <button type="submit" disabled={form.isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

**Eliminates:**
- Manual form state management
- Change handler functions
- Validation logic boilerplate
- Error display logic
- Submit handling

---

### 5. `useTableData` - Search, Filter, Sort

Manages search, filter, and sort functionality for tables/lists.

**Use Case:** Tables with search, filter, and sort capabilities.

```tsx
import { useTableData } from '@/hooks';

function TournamentsTable({ tournaments }) {
  const table = useTableData({
    data: tournaments,
    searchFields: (t) => [t.name, t.location, t.type],
    filterFn: (t, filter) => {
      if (filter === 'all') return true;
      return t.status === filter;
    },
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={table.searchQuery}
        onChange={(e) => table.setSearchQuery(e.target.value)}
      />

      <select
        value={table.filterValue}
        onChange={(e) => table.setFilterValue(e.target.value)}
      >
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>

      <p>Showing {table.filteredCount} of {table.totalCount}</p>

      <table>
        <thead>
          <tr>
            <th onClick={() => table.setSorting('name')}>
              Name {table.sortField === 'name' && (table.sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => table.setSorting('date')}>
              Date {table.sortField === 'date' && (table.sortDirection === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {table.filteredData.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Eliminates:**
- `const [searchQuery, setSearchQuery] = useState('')`
- `const [filterValue, setFilterValue] = useState('all')`
- Manual filtering logic
- Manual sorting logic
- Derived counts

---

## 🎨 BaseModal Component

Reusable modal component with consistent styling and behavior.

**Use Case:** Creating consistent modals throughout the app.

```tsx
import BaseModal from '@/components/common/BaseModal';

function EditTournamentModal({ isOpen, onClose, tournament }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Tournament"
      size="2xl"
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </>
      }
    >
      {/* Modal content */}
      <form>{/* form fields */}</form>
    </BaseModal>
  );
}
```

**Features:**
- Consistent header with title and close button
- Flexible content area via children prop
- Optional footer for action buttons
- Configurable sizes (sm, md, lg, xl, 2xl, 3xl, 4xl, full)
- Overlay click to close (configurable)
- Escape key to close
- Body scroll lock when open
- Accessibility support (aria labels, roles)

**Eliminates:**
- 50+ lines of modal boilerplate per modal
- Inconsistent modal styling
- Missing accessibility features
- Duplicate overlay/backdrop code

---

## 💡 Best Practices

1. **Use hooks at the top level of components**
   ```tsx
   // ✅ Good
   function MyComponent() {
     const modal = useModal();
     // ...
   }

   // ❌ Bad
   function MyComponent() {
     if (condition) {
       const modal = useModal(); // Don't call hooks conditionally
     }
   }
   ```

2. **Combine hooks for complex scenarios**
   ```tsx
   function ComplexPage() {
     const { data, loading, refetch } = useAsyncData({...});
     const modal = useModal();
     const { submit } = useAsyncSubmit({...});
     const table = useTableData({ data: data?.items || [] });

     // Use all hooks together
   }
   ```

3. **Type your hooks for better DX**
   ```tsx
   const modal = useModal<Tournament>(); // TypeScript will infer modal.data type
   const form = useForm<FormValues>({...}); // Type-safe form values
   ```

---

## 📈 Impact

By using these hooks, the codebase has:
- **Reduced code duplication** by ~500+ lines
- **Standardized patterns** across all admin pages and components
- **Improved maintainability** with centralized, reusable logic
- **Better type safety** with TypeScript generics
- **Consistent UX** with standardized error handling and loading states

---

## 🔄 Migration Guide

### Before (Old Pattern):
```tsx
function OldComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.getData();
      setData(response.data);
    } catch (err) {
      setError(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ... rest of component
}
```

### After (Using Hooks):
```tsx
function NewComponent() {
  const { data, loading, error, refetch } = useAsyncData({
    fetchFn: () => api.getData(),
    errorMessage: 'Failed to load data',
  });

  const modal = useModal();

  // ... rest of component (much cleaner!)
}
```

---

## 🚀 Future Enhancements

Potential additions for future:
- `usePagination` - For paginated data
- `useDebounce` - For debounced search
- `useLocalStorage` - For persisting state
- `useMediaQuery` - For responsive behavior
- `useKeyPress` - For keyboard shortcuts
