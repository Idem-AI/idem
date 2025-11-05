<?php

declare(strict_types=1);

namespace phpDocumentor\Reflection\Php\Factory\Reducer;

use phpDocumentor\Reflection\Php\Factory\ContextStack;
use phpDocumentor\Reflection\Php\StrategyContainer;

interface Reducer
{
    /**
     * @param TCarry|null $carry
     *
     * @return TCarry|null
     *
     * @template TCarry of object
     */
    public function reduce(
        ContextStack $context,
        object $object,
        StrategyContainer $strategies,
        object|null $carry,
    ): object|null;
}
