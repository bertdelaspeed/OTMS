# Undo Functionality Implementation

## Overview
Added a global undo system that allows users to reverse accidental deletions within an 8-second window.

## Implementation Details

### 1. Undo Provider (`src/undo.tsx`)
- Created a new `UndoProvider` context that wraps the entire app
- Maintains a stack of undoable actions with automatic expiration (8 seconds)
- Displays a centered toast notification with:
  - Action description
  - Progress bar showing remaining time
  - "Undo" button to restore the deleted item
  - Dismiss button to cancel the undo

### 2. Integration Points
Added undo support to all delete operations:

#### People Page (`src/views/People.tsx`)
- Captures person data and team memberships before deletion
- Undo restores the person with all team assignments

#### Teams Page (`src/views/Teams.tsx`)
- Captures complete team data before deletion
- Undo restores the team with all members

#### Tasks Page (`src/views/Tasks.tsx`)
- Captures task data before deletion
- Undo restores the task with all assignments and status

#### Profile Page (`src/views/Profile.tsx`)
- **Remove Event**: Captures event data before deletion
- **Remove Person**: Captures person data and team memberships
- Both support full restoration via undo

### 3. Internationalization (`src/i18n.tsx`)
Added translation keys for undo messages:
- English: "X was removed/deleted"
- French: "X a été supprimé(e)"

## User Experience

1. User clicks delete on any item
2. Item is immediately removed from the UI
3. A centered toast appears at the bottom with:
   - Message: "X was removed"
   - Animated progress bar (8 seconds)
   - "Undo" button
   - Dismiss (X) button
4. If user clicks "Undo" within 8 seconds:
   - Item is fully restored with all its data
   - Toast disappears
5. If toast expires or is dismissed:
   - Deletion is permanent

## Technical Notes

- Undo actions are stored in a stack managed by `UndoProvider`
- Each action includes a restore function that re-dispatches the ADD action
- The progress bar uses CSS transitions for smooth animation
- Auto-cleanup removes expired actions from the stack
- All restore operations maintain data integrity (team memberships, task assignments, etc.)

## Files Modified

1. `src/undo.tsx` - New undo provider and toast component
2. `src/App.tsx` - Wrapped app with UndoProvider
3. `src/views/People.tsx` - Added undo to person deletion
4. `src/views/Teams.tsx` - Added undo to team deletion
5. `src/views/Tasks.tsx` - Added undo to task deletion
6. `src/views/Profile.tsx` - Added undo to event and person deletion
7. `src/i18n.tsx` - Added undo message translations
