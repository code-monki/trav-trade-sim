import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HamburgerMenu from '../../src/components/HamburgerMenu.vue'

afterEach(() => {
  // Remove any mousedown listeners added during mount
  document.body.innerHTML = ''
})

describe('HamburgerMenu', () => {
  it('renders the menu button', () => {
    const wrapper = mount(HamburgerMenu)
    expect(wrapper.find('.hm-btn').exists()).toBe(true)
  })

  it('dropdown is hidden initially', () => {
    const wrapper = mount(HamburgerMenu)
    expect(wrapper.find('.hm-dropdown').exists()).toBe(false)
  })

  it('clicking the button opens the dropdown', async () => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.find('.hm-dropdown').exists()).toBe(true)
  })

  it('clicking the button a second time closes the dropdown', async () => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.find('.hm-dropdown').exists()).toBe(false)
  })

  it('dropdown contains six menu items (non-referee)', async () => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.findAll('.hm-item')).toHaveLength(6)
  })

  it.each([
    ['themes',  'Themes'],
    ['about',   'About'],
    ['help',    'Help'],
    ['signout', 'Sign Out'],
  ])('emits "%s" when the %s item is clicked', async (event, label) => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    const item = wrapper.findAll('.hm-item').find(i => i.text().includes(label))
    await item.trigger('click')
    expect(wrapper.emitted()[event]).toBeTruthy()
  })

  it('closes the dropdown after any menu item is clicked', async () => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    await wrapper.findAll('.hm-item')[0].trigger('click')
    expect(wrapper.find('.hm-dropdown').exists()).toBe(false)
  })

  it('renders mobile-extras slot content inside the open dropdown', async () => {
    const wrapper = mount(HamburgerMenu, {
      slots: { 'mobile-extras': '<div class="test-extra">Milieu picker</div>' },
    })
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.find('.hm-mobile-extras .test-extra').exists()).toBe(true)
  })

  it('omits the mobile-extras section when no slot content is provided', async () => {
    const wrapper = mount(HamburgerMenu)
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.find('.hm-mobile-extras').exists()).toBe(false)
  })

  it('closes the dropdown on mousedown outside the component', async () => {
    const wrapper = mount(HamburgerMenu, { attachTo: document.body })
    await wrapper.find('.hm-btn').trigger('click')
    expect(wrapper.find('.hm-dropdown').exists()).toBe(true)

    await document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.hm-dropdown').exists()).toBe(false)
  })
})
