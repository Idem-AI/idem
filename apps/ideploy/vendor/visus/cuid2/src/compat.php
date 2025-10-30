<?php

if (!is_callable('getmypid')) {
    function getmypid(): int
    {
        return rand(1, 32768);
    }
}

if (!is_callable('gethostname')) {
    function gethostname(): string
    {
        return substr(str_shuffle('abcdefghjkmnpqrstvwxyz0123456789'), 0, 32);
    }
}
