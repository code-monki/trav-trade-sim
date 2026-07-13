import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { defineComponent, h } from 'vue'
import App from '../../src/App.vue'

// A child that throws during render — simulates an uncaught error from
// anywhere in the router-view subtree, which App.vue's onErrorCaptured
// wrapper should catch instead of leaving a blank screen.
const Bomb = defineComponent({
  name: 'Bomb',
  render() { throw new Error('boom') },
})

describe('App.vue error boundary', () => {
  it('renders the fallback UI instead of crashing when a descendant throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
        stubs: { 'router-view': Bomb },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain("Something went wrong")
    expect(wrapper.find('button').text()).toBe('Reload page')

    spy.mockRestore()
  })

  it('renders router-view normally when nothing throws', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
        stubs: { 'router-view': { template: '<div class="ok">fine</div>' } },
      },
    })

    expect(wrapper.find('.ok').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Something went wrong')
  })

  it('shows a schema-drift-specific message instead of the generic one', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            createSpy: vi.fn,
            initialState: { appError: { fatalError: { kind: 'schema-drift', message: 'Database schema drift detected' } } },
          }),
        ],
        stubs: { 'router-view': { template: '<div/>' } },
      },
    })

    expect(wrapper.text()).toContain("database schema is out of date")
    expect(wrapper.text()).not.toContain('Something went wrong')
  })
})
