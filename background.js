


chrome.action.onClicked.addListener(async tab => {
  console.log('@chrome.action.onClicked', tab)

  await chrome.tabs.create({ url: '/page/index.html', index: tab.index + 1 })
})



chrome.commands.onCommand.addListener(async command => {
  console.log(`@chrome.commands.onCommand`, command)

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (command === 'Delete') {
    await chrome.tabs.remove(tab.id)
  }

  else if (command === 'Right') {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const newIndex = (tab.index + 1 + tabs.length) % tabs.length
    const newTab = tabs[newIndex]
    await chrome.tabs.update(newTab.id, { active: true })
  }

  else if (command === 'Left') {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const newIndex = (tab.index - 1 + tabs.length) % tabs.length
    const newTab = tabs[newIndex]
    await chrome.tabs.update(newTab.id, { active: true })
  }

  else if (command === 'OpenPage') {
    await chrome.tabs.create({ url: '/page/index.html', index: tab.index + 1 })
  }

})