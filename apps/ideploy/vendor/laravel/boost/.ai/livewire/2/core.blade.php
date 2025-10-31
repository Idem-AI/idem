## Livewire 2

- `wire:model` is live by default.
- Components typically exist in the `App\Http\Livewire` namespace.
- Use `emit()`, `emitTo()`, `emitSelf()`, and `dispatchBrowserEvent()` for events.
- Alpine is included separately to Livewire.
- You can listen for `livewire:load` to hook into Livewire initialization, and `Livewire.onPageExpired` for when the page expires:
@verbatim
<code-snippet name="livewire:load example" lang="js">
document.addEventListener('livewire:load', function () {
    Livewire.onPageExpired(() => {
        alert('Your session expired');
    });

    Livewire.onError(status => console.error(status));
});
</code-snippet>
@endverbatim
