<div class="p-4 bg-yellow-100 border border-yellow-400 text-yellow-900">
    <h3 class="font-bold">DEBUG ADMIN PANEL</h3>
    <ul class="list-disc ml-5">
        <li>Auth check: {{ auth()->check() ? 'YES' : 'NO' }}</li>
        <li>User exists: {{ auth()->user() ? 'YES' : 'NO' }}</li>
        @if(auth()->user())
            <li>User ID: {{ auth()->user()->id }}</li>
            <li>User Email: {{ auth()->user()->email }}</li>
            <li>User idem_role: {{ auth()->user()->idem_role ?? 'NULL' }}</li>
            <li>Is Admin: {{ auth()->user()->idem_role === 'admin' ? 'YES' : 'NO' }}</li>
            <li>Condition result: {{ (auth()->user() && auth()->user()->idem_role === 'admin') ? 'SHOULD SHOW MENU' : 'SHOULD NOT SHOW MENU' }}</li>
        @endif
    </ul>
</div>
