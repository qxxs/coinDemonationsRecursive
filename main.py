def coinAmount(amount, coins=[10, 5, 1]):
    if amount == 0:
        return []
    
    for coin in coins:
        if coin <= amount:
            return [coin] + coinAmount(amount - coin, coins)
    return []


amount = 28
result = coinAmount(amount)
print(f"To make {amount} cents, we need: {result}")
print(f"The final amount of coins is: {len(result)}")
